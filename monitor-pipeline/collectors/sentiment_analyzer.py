"""
AI 요약 + 감성 분석 모듈
- Gemini API 키 3개 폴백
- Gemini 다중 모델 순차 폴백
- Claude 순차 모델 폴백

naver-cafe-keyword-monitor/collectors/sentiment_analyzer.py 이식본.
AIAnalyzer 클래스는 prompts_config dict + 환경변수 API 키만으로 동작하는 순수 클래스라 수정 없이 재사용.
load_prompts_from_sheet/analyze_batch 는 구글시트 전용이라 이 프로젝트에서는 호출하지 않는다 (참고용으로만 남김).
"""

import os
import json
import re
import time
from typing import Dict, Optional, List, Tuple

try:
    import google.generativeai as genai
except ImportError:
    genai = None

try:
    from anthropic import Anthropic
except ImportError:
    Anthropic = None


class ClaudeInsufficientCreditError(RuntimeError):
    """Claude API 잔액 부족으로 판독을 더 진행할 수 없는 상태입니다."""

    def __init__(self, message: str, processed_count: int = 0):
        super().__init__(message)
        self.processed_count = processed_count



class AIAnalyzer:
    """Gemini 또는 Claude를 사용한 AI 분석"""

    def __init__(self, prompts_config: Dict = None):
        self.prompts_config = prompts_config or self._default_prompts()
        self.ai_provider = (
            os.getenv("AI_PROVIDER")
            or self.prompts_config.get("ai_provider")
            or "gemini"
        ).strip().lower()
        if self.ai_provider not in {"gemini", "claude"}:
            print(f"[WARN] 알 수 없는 AI 제공자 '{self.ai_provider}', Gemini로 처리합니다.")
            self.ai_provider = "gemini"

        # =========================
        # Gemini API 키 3개 설정
        # GitHub Secrets: GEMINI_API_KEY_4468, GEMINI_API_KEY_SS, GEMINI_API_KEY_KIM
        # =========================
        self.gemini_keys: List[Tuple[str, str]] = []

        gemini_key_4468 = os.getenv("GEMINI_API_KEY_4468", "").strip()
        gemini_key_ss = os.getenv("GEMINI_API_KEY_SS", "").strip()
        gemini_key_kim = os.getenv("GEMINI_API_KEY_KIM", "").strip()

        if gemini_key_4468:
            self.gemini_keys.append(("4468", gemini_key_4468))

        if gemini_key_ss:
            self.gemini_keys.append(("SS", gemini_key_ss))

        if gemini_key_kim:
            self.gemini_keys.append(("KIM", gemini_key_kim))

        self.gemini_enabled = len(self.gemini_keys) > 0 and genai is not None

        self.gemini_model_names = self._get_env_list(
            "GEMINI_MODELS",
            [
                "gemini-3.5-flash",
                "gemini-3-flash",
                "gemini-3.1-flash-lite",
                "gemini-2.5-flash",
                "gemini-2.5-flash-lite",
            ],
        )

        self.gemini_api_keys = {account_name: api_key for account_name, api_key in self.gemini_keys}
        self.gemini_models_by_account: Dict[str, List[str]] = {}
        self.current_account_index = 0
        self.current_model_index = 0

        if self.ai_provider == "gemini" and self.gemini_enabled:
            print("  [Gemini 계정별 모델 초기화 중...]")

            for account_name, api_key in self.gemini_keys:
                try:
                    models = []

                    print(f"\n    [{account_name} 계정]")
                    for model_name in self.gemini_model_names:
                        try:
                            models.append(model_name)
                            print(f"      ✓ {model_name} 후보 등록")
                        except Exception as e:
                            print(f"      ✗ {model_name} 실패: {str(e)[:60]}")

                    if models:
                        self.gemini_models_by_account[account_name] = models
                    else:
                        print(f"      ✗ {account_name}: 사용 가능한 모델 없음")

                except Exception as e:
                    print(f"    ✗ {account_name} 초기화 실패: {str(e)[:80]}")

            if not self.gemini_models_by_account:
                print("\n  ✗ Gemini: 모든 계정 초기화 실패")
                self.gemini_enabled = False

        elif self.ai_provider == "gemini" and not self.gemini_keys:
            print("[INFO] Gemini API 키 없음")
        elif self.ai_provider == "gemini" and genai is None:
            print("[WARN] google-generativeai 패키지 미설치")

        # =========================
        # Claude API 설정
        # GitHub Secrets: CLAUDE_API_KEY 또는 ANTHROPIC_API_KEY
        # =========================
        self.claude_key = (
            os.getenv("CLAUDE_API_KEY", "").strip()
            or os.getenv("ANTHROPIC_API_KEY", "").strip()
        )
        self.claude_model_names = self._get_env_list(
            "CLAUDE_MODELS",
            [
                "claude-sonnet-4-6",
            ],
        )
        self.claude_client = None
        self.claude_enabled = bool(self.claude_key) and Anthropic is not None

        if self.ai_provider == "claude" and self.claude_enabled:
            self.claude_client = Anthropic(api_key=self.claude_key)
            print("\n[INFO] Claude 분석 활성화")
            print(f"  ✓ Claude 모델 후보: {', '.join(self.claude_model_names)}")
        elif self.ai_provider == "claude" and not self.claude_key:
            print("[INFO] Claude API 키 없음")
        elif self.ai_provider == "claude" and Anthropic is None:
            print("[WARN] anthropic 패키지 미설치")

        self.enabled = (
            (self.ai_provider == "gemini" and self.gemini_enabled)
            or (self.ai_provider == "claude" and self.claude_enabled)
        )

        # =========================
        # 사용 통계
        # =========================
        self.stats = {
            "gemini": {},
            "claude": {},
            "failed": 0,
            "ad": 0,
            "pattern_match": 0,
        }

        if self.ai_provider == "gemini" and self.gemini_enabled:
            print("\n[INFO] AI 분석 활성화")
            print(f"  ✓ Gemini 계정: {len(self.gemini_models_by_account)}개")
            for account_name in self.gemini_models_by_account.keys():
                model_count = len(self.gemini_models_by_account[account_name])
                print(f"    - {account_name}: {model_count}개 모델")
        elif self.ai_provider == "claude" and self.claude_enabled:
            pass
        else:
            print("[INFO] AI 분석 비활성화: 사용 가능한 API 키 없음")

    def _get_env_list(self, env_name: str, default_list: List[str]) -> List[str]:
        """쉼표로 구분된 환경변수 목록을 읽음"""
        raw_value = os.getenv(env_name, "").strip()

        if not raw_value:
            return default_list

        values = [item.strip() for item in raw_value.split(",") if item.strip()]
        return values or default_list

    @staticmethod
    def _is_claude_insufficient_credit_error(exc: Exception) -> bool:
        error_parts = [str(exc)]
        for attr_name in ('body', 'message', 'response'):
            attr_value = getattr(exc, attr_name, None)
            if attr_value is not None:
                error_parts.append(str(attr_value))

        error_text = ' '.join(error_parts).lower()
        balance_markers = (
            'credit balance is too low',
            'insufficient credit',
            'insufficient balance',
            'purchase credits',
            'credit_balance_too_low',
            'billing balance',
        )
        return any(marker in error_text for marker in balance_markers)

    def _default_prompts(self) -> Dict:
        """기본 설정"""
        return {
            "main_prompt": None,
            "prompt_cell": "A1",
            "ad_keywords": [
                "추천",
                "알려주",
                "알려 주",
                "찾아요",
                "찾고",
                "어디",
                "어떤 곳",
            ],
            "ad_patterns": [
                ["안녕하세요", "학원입니다"],
                ["안녕하세요", "교습소입니다"],
                ["저희는", "학원입니다"],
                ["모집합니다", "학원"],
            ],
        }

    def analyze(
        self,
        content: str,
        comments: str = "",
        keyword: str = "",
        title: str = "",
        target_region: str = "",
    ) -> Dict:
        """제목/본문/댓글 종합 요약 + 감성 분석 + 광고 판단"""
        full_text = f"{title} {content} {comments}".strip()

        if len(full_text) < 10:
            return self._empty_result()

        brand_mode = self._is_brand_context(keyword, content, comments, title)
        is_ad = self._is_advertisement(f"{title}\n{content}")

        # =========================
        # Claude: 지정된 모델 순서대로 폴백
        # =========================
        if self.ai_provider == "claude":
            if not self.claude_enabled:
                return self._handle_failure(is_ad, content, brand_mode)

            for model_name in self.claude_model_names:
                print(f"    → Claude 시도: Claude-{model_name}")

                result = self._try_claude(
                    content=content,
                    comments=comments,
                    keyword=keyword,
                    title=title,
                    is_ad=is_ad,
                    brand_mode=brand_mode,
                    model_name=model_name,
                    target_region=target_region,
                )

                if result:
                    self.stats["claude"][model_name] = self.stats["claude"].get(model_name, 0) + 1

                    used_model = f"Claude-{model_name}"

                    if is_ad:
                        self.stats["ad"] += 1
                        result["sentiment"] = "광고"
                        result["sentiment_emoji"] = self._add_emoji("광고")
                        result["mentioned_academies"] = []

                    result["ai_model"] = used_model
                    print(f"    ✓ 사용 및 기록: {used_model}")
                    return result

                print(f"    ✗ Claude-{model_name} 시도 실패 또는 오류")

            return self._handle_failure(is_ad, content, brand_mode)

        # =========================
        # Gemini: 같은 모델을 계정별로 먼저 순환한 뒤 다음 모델로 이동
        # =========================
        if self.gemini_enabled:
            account_names = list(self.gemini_models_by_account.keys())

            if not account_names:
                return self._handle_failure(is_ad, content, brand_mode)

            total_attempts = sum(
                len(models) for models in self.gemini_models_by_account.values()
            )

            for _ in range(total_attempts):
                account_name = account_names[self.current_account_index]
                models = self.gemini_models_by_account[account_name]

                if not models:
                    self._move_next_account(account_names)
                    continue

                model_name = models[self.current_model_index]
                api_key = self.gemini_api_keys.get(account_name, "")
                print(f"    → Gemini 시도: Gemini-{account_name}-{model_name}")

                result = self._try_gemini(
                    content=content,
                    comments=comments,
                    keyword=keyword,
                    title=title,
                    is_ad=is_ad,
                    brand_mode=brand_mode,
                    account_name=account_name,
                    api_key=api_key,
                    model_name=model_name,
                    target_region=target_region,
                )

                if result:
                    stat_key = f"{account_name}/{model_name}"
                    self.stats["gemini"][stat_key] = self.stats["gemini"].get(stat_key, 0) + 1

                    used_model = f"Gemini-{account_name}-{model_name}"

                    if is_ad:
                        self.stats["ad"] += 1
                        result["sentiment"] = "광고"
                        result["sentiment_emoji"] = self._add_emoji("광고")
                        result["mentioned_academies"] = []

                    result["ai_model"] = used_model
                    print(f"    ✓ 사용 및 기록: {used_model}")
                    self._move_next_gemini(account_names)
                    return result

                print(f"    ✗ Gemini-{account_name}-{model_name} 한도 또는 오류")

                self._move_next_gemini(account_names)

        # =========================
        # 모든 AI 실패 시
        # =========================
        return self._handle_failure(is_ad, content, brand_mode)

    def _move_next_gemini(self, account_names: List[str]):
        """다음 Gemini 계정/모델로 이동"""
        if not account_names:
            return

        self.current_account_index = (self.current_account_index + 1) % len(account_names)

        if self.current_account_index == 0:
            first_account_models = self.gemini_models_by_account.get(account_names[0], [])
            if first_account_models:
                self.current_model_index = (self.current_model_index + 1) % len(first_account_models)

    def _move_next_account(self, account_names: List[str]):
        """다음 계정으로 이동"""
        self.current_account_index = (self.current_account_index + 1) % len(account_names)
        self.current_model_index = 0

    def _has_owned_brand(self, text: str) -> bool:
        """자사 브랜드명이 실제 맥락에 있는지 확인"""
        text = (text or "").lower()
        olympiad_competition_terms = [
            "올림피아드 경시",
            "올림피아드대회",
            "올림피아드 대회",
            "수학올림피아드",
            "수학 올림피아드",
            "과학올림피아드",
            "과학 올림피아드",
            "kmo",
            "imo",
            "경시대회",
            "경시 대회",
        ]
        if any(term in text for term in olympiad_competition_terms):
            text = text.replace("올림피아드", "")

        brand_keywords = ["올림피아드학원", "올림피아드 학원", "올림피아드교육", "올림피아드 교육", "glec", "유투엠"]
        return any(brand.lower() in text for brand in brand_keywords)

    def _is_brand_context(self, keyword: str, content: str, comments: str = "", title: str = "") -> bool:
        """자사 브랜드 맥락인지 확인"""
        return self._has_owned_brand(f"{keyword} {title} {content} {comments}")

    def _handle_failure(self, is_ad: bool, content: str, brand_mode: bool = False) -> Dict:
        """AI 실패 처리"""
        if brand_mode:
            self.stats["failed"] += 1
            return {
                "sentiment": "기타",
                "sentiment_emoji": self._add_emoji("기타"),
                "ai_model": "",
            }

        if is_ad:
            self.stats["ad"] += 1
            self.stats["pattern_match"] += 1

            return {
                "sentiment": "광고",
                "sentiment_emoji": self._add_emoji("광고"),
                "ai_model": "Pattern-Match",
            }

        self.stats["failed"] += 1
        return self._empty_result()

    def _is_advertisement(self, content: str) -> bool:
        """간단 광고글 판단"""
        first_part = content[:150].strip()

        ad_keywords = self.prompts_config.get("ad_keywords", [])
        if any(keyword in first_part for keyword in ad_keywords):
            return False

        ad_patterns = self.prompts_config.get("ad_patterns", [])
        for pattern in ad_patterns:
            if len(pattern) >= 2:
                first = pattern[0]
                second = pattern[1]

                if first and second and first in first_part and second in first_part:
                    return True

        return False

    def _try_gemini(
        self,
        content: str,
        comments: str,
        keyword: str,
        title: str,
        is_ad: bool,
        brand_mode: bool,
        account_name: str,
        api_key: str,
        model_name: str,
        target_region: str = "",
    ) -> Optional[Dict]:
        """Gemini API 시도"""
        try:
            if not api_key:
                return None

            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(model_name)
            prompt = self._build_prompt(content, comments, keyword, title, brand_mode, target_region)

            time.sleep(0.5)

            response = model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.3,
                    max_output_tokens=1200,
                ),
            )

            result_text = response.text.strip()
            source_text = f"{keyword} {title} {content} {comments}"
            result = self._parse_json(result_text, brand_mode, source_text, target_region)

            if result and not result.get("mentioned_academies") and result.get("sentiment") not in {"광고", "무관", "대상아님"}:
                print(f"      [언급학원 누락 AI응답] {result_text[:600].replace(chr(10), ' ')}")

            if result:
                result["sentiment_emoji"] = self._add_emoji(result.get("sentiment", ""))

            return result

        except Exception as e:
            error_msg = str(e)[:120]
            if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
                pass
            elif "404" in error_msg:
                pass
            else:
                print(f"      [Gemini 오류] {error_msg}")

            return None

    def _try_claude(
        self,
        content: str,
        comments: str,
        keyword: str,
        title: str,
        is_ad: bool,
        brand_mode: bool,
        model_name: str,
        target_region: str = "",
    ) -> Optional[Dict]:
        """Claude API 시도"""
        try:
            if not self.claude_client:
                return None

            prompt = self._build_prompt(content, comments, keyword, title, brand_mode, target_region)

            time.sleep(0.5)

            response = self.claude_client.messages.create(
                model=model_name,
                max_tokens=4096,
                temperature=0.3,
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
            )

            result_text_parts = []
            for block in getattr(response, "content", []) or []:
                block_text = getattr(block, "text", "")
                if block_text:
                    result_text_parts.append(block_text)

            result_text = "\n".join(result_text_parts).strip()
            if not result_text:
                stop_reason = getattr(response, "stop_reason", "?")
                print(f"      [Claude 오류] 응답 content 비어있음 (stop_reason: {stop_reason})")
                return None

            source_text = f"{keyword} {title} {content} {comments}"
            result = self._parse_json(result_text, brand_mode, source_text, target_region)

            if result is None:
                print(f"      [Claude 오류] JSON 파싱 실패: {result_text[:200].replace(chr(10), ' ')}")
                return None

            if not result.get("mentioned_academies") and result.get("sentiment") not in {"광고", "무관", "대상아님"}:
                print(f"      [언급학원 누락 AI응답] {result_text[:600].replace(chr(10), ' ')}")

            if result:
                result["sentiment_emoji"] = self._add_emoji(result.get("sentiment", ""))

            return result

        except Exception as e:
            if self._is_claude_insufficient_credit_error(e):
                error_msg = str(e)[:300]
                print(f"      [Claude 잔액 부족] {error_msg}")
                raise ClaudeInsufficientCreditError(error_msg) from e

            error_msg = str(e)[:200]
            print(f"      [Claude 오류] {error_msg}")
            return None

    def _build_prompt(
        self,
        content: str,
        comments: str,
        keyword: str = "",
        title: str = "",
        brand_mode: bool = False,
        target_region: str = "",
    ) -> str:
        """프롬프트 생성"""
        main_prompt = (self.prompts_config.get("main_prompt") or "").strip()
        prompt_cell = self.prompts_config.get("prompt_cell", "A1")

        title_part = title[:500]
        content_part = content[:6000]
        comments_part = comments[:12000]
        allowed_categories = "광고 / 장점 / 단점 / 추천 / 비교 / 정보공유 / 대상아님 / 기타"

        academy_names = self.prompts_config.get("academy_names", [])
        academy_list_rule = ""
        if academy_names:
            academy_list_rule = f"""
[모니터링 학원 목록]
아래 학원명들은 이 지역에서 모니터링 중인 학원입니다. 원문에 이 이름들이 등장하면 반드시 `언급학원`에 포함하세요.
{', '.join(academy_names)}
"""

        academy_aliases = self.prompts_config.get("academy_aliases", {})
        if academy_aliases:
            from collections import defaultdict as _dd
            _groups = _dd(list)
            for _variant, _std in academy_aliases.items():
                _groups[_std].append(_variant)
            _alias_lines = "\n".join(
                f"  - {', '.join(variants)} → {std}"
                for std, variants in _groups.items()
            )
            name_rule = f"""
[학원명 표준화 규칙]
`언급학원` 배열에 넣기 전에 반드시 아래 규칙을 적용하세요.
1. 아래 목록의 변형은 표준명으로 통일하세요:
{_alias_lines}
2. 목록에 없는 학원명도 '학원', '수학', '어학원', '영어', '교육원' 등 일반 접미사를 제거하고 핵심 이름만 남기세요.
   예: '청어람학원' → '청어람',  '파인만수학' → '파인만',  '늘푸른어학원' → '늘푸른'
3. 같은 학원이 여러 번 나와도 한 번만 넣으세요.
"""
        else:
            name_rule = ""

        if main_prompt:
            return f"""[프롬프트 설정 {prompt_cell}]
{main_prompt}

[검색어]
{keyword}

[검색설정 기본 타겟지역]
{target_region}

[게시글 제목]
{title_part}

[게시글 본문]
{content_part}

[댓글]
{comments_part}

반드시 위 프롬프트의 분류 기준과 출력 형식을 우선 적용하세요.
게시글과 댓글 원문에 실제 등장한 학원명을 모두 찾아 `언급학원` 배열에 넣으세요.
{academy_list_rule}{name_rule}
추천 여부와 관계없이 단순 언급, 질문, 비교 대상도 포함하고 같은 학원은 한 번만 넣으세요.
학원명이 없거나 게시물유형이 `광고` 또는 `무관`이면 `언급학원`은 빈 배열로 출력하세요.
`언급학원`은 현재 검색어 학원만이 아니라 게시글 전체에서 실제로 등장한 모든 학원을 추출하세요.
같은 게시글의 여러 검색어 행 중 대표행 한 곳에만 저장하는 처리는 시스템이 수행합니다.
`장점카테고리`, `단점카테고리`는 반드시 현재 검색어 학원에 대한 평가만 사용하세요.
다른 학원에 대한 추천, 셔틀, 관리, 성적, 수업 등의 평가는 검색어 학원의 분석에 섞지 마세요.
댓글의 답글 맥락을 확인해 어떤 학원에 대한 경험담인지 구분하세요.
예를 들어 검색어가 파인만이고 청어람에 대해서만 셔틀이 언급되면 파인만의 `셔틀/접근성`으로 선택하지 마세요.
게시물유형이 `무관`이면 `요약`, `지역`은 빈 문자열로,
`장점카테고리`, `단점카테고리`, `언급학원`은 빈 배열로 출력하세요.
출력 JSON 최상위에 반드시 `지역` 필드를 포함하세요.
게시물유형이 `광고` 또는 `무관`이면 `지역`은 빈값으로 출력하세요.
그 외 게시물의 `지역`은 반드시 한 개만 출력하세요. `광진, 성동`이나 `광진/성동`처럼 복수로 출력하지 마세요.
검색설정 기본 타겟지역은 1차 참고값일 뿐입니다. 제목, 본문, 댓글에서 실제 지역이 확인되면 그 지역을 최종값으로 사용하세요.
AI가 원문을 근거로 결정한 최종 지역은 1차 타겟지역과 달라도 됩니다.
표기는 `광진구`가 아닌 `광진`, `성동구`가 아닌 `성동`처럼 행정구역 접미사 없이 작성하세요.
원문에서 더 정확한 지역을 확인할 수 없으면 검색설정 기본 타겟지역 중 가장 적합한 한 곳을 사용하세요.
근거 없이 인접 지역을 추측하지 마세요.
기존 프롬프트의 출력 예시와 관계없이 최종 JSON에는 반드시 아래 10개 키를 모두 포함하세요.
{{
  "요약": "게시글과 댓글 요약",
  "지역": "한 개 지역 또는 빈 문자열",
  "게시물유형": "광고 또는 후기 또는 질문 또는 비교 또는 정보 또는 무관",
  "장점카테고리": ["현재 검색어 학원 장점태그"],
  "단점카테고리": ["현재 검색어 학원 단점태그"],
  "장점근거": {{"태그1": "해당 태그를 뒷받침하는 원문 핵심 문구 (40자 이내)"}},
  "단점근거": {{"태그1": "해당 태그를 뒷받침하는 원문 핵심 문구 (40자 이내)"}},
  "언급학원": ["게시글 전체에서 실제 등장한 학원명"],
  "분석대상": "현재 검색어",
  "학원별평가": {{
    "학원명": {{
      "장점카테고리": ["태그"],
      "장점근거": {{"태그": "원문 핵심 문구 (40자 이내)"}},
      "단점카테고리": ["태그"],
      "단점근거": {{"태그": "원문 핵심 문구 (40자 이내)"}}
    }}
  }}
}}
`장점근거`/`단점근거`는 장점카테고리/단점카테고리 각 태그에 대해 원문에서 직접 발췌한 짧은 문구를 넣으세요.
`학원별평가`는 `언급학원` 배열의 모든 학원에 대해 게시물·댓글에서 직접 언급된 장단점을 추출하세요. 언급은 있지만 장단점이 없으면 빈 배열/객체로 두세요.
반드시 JSON만 출력하세요. 다른 설명, 마크다운, 코드블록은 출력하지 마세요.
"""

        extra_prompt = f"""

[추가 참고 규칙]
{main_prompt}
""" if main_prompt else ""

        return f"""당신은 지역 커뮤니티(맘카페, 소모임 등)의 게시글과 댓글을 분석하는 데이터 분석가입니다.
검색어로 지정된 학원 관련 게시글을 분류하고 요약합니다.

[분석 순서]
반드시 아래 순서로 판단하세요.
1. 게시글 제목과 본문을 먼저 읽고 주제와 의도를 파악합니다.
2. 댓글을 읽고 반응의 방향을 확인합니다.
3. 제목, 본문, 댓글을 종합하여 최종 분류를 결정합니다.

[광고 우선 판단]
아래 조건 중 하나라도 해당하면 다른 분류보다 먼저 광고로 처리하세요.
- 학원 또는 업체 공식 계정의 홍보성 글
- 신입생 모집, 설명회, 이벤트, 시간표 안내
- 전화번호, 카카오톡 ID, 블로그 또는 플레이스 링크 포함
- 합격 실적, 100점 배출 등 성과 과시

단, "추천해주세요", "어디가 좋나요?" 형태의 이용자 질문은 광고가 아닙니다.

[검색어]
{keyword}

[게시글 제목]
{title_part}

[게시글 본문]
{content_part}

[댓글]
{comments_part}

[분류 기준]
- 광고: 위 광고 조건에 해당하는 홍보성 게시글 또는 댓글
- 장점: 검색어 학원에 대한 만족 후기, 성적 향상, 선생님 또는 시스템 긍정 경험. 댓글에서 긍정 반응이 우세한 경우 포함
- 단점: 불만, 비추천, 실패 경험, 관리 부족, 비용 불만, 효과 없음. 댓글에서 부정 반응이 우세한 경우 포함
- 추천: 특정 학원 추천 요청 또는 추천 정보 제공이 중심인 글. "어디가 좋을까요?", "보내보신 분?" 형태
- 비교: 두 개 이상의 학원 또는 프로그램을 비교하거나 장단점이 균형적으로 혼재된 경우
- 정보공유: 비용, 레벨테스트, 커리큘럼, 개강일, 입시 정보 등 사실 전달이 중심인 경우
- 대상아님: 학습, 학원, 교육, 입시, 수업, 시험과 무관한 생활글, 거래글, 행사글, 잡담
- 기타: 학습 관련 맥락은 있으나 위 항목으로 분류하기 어려운 게시글

[출력 규칙]
- summary는 게시글 내용, 댓글 반응 순서로 2~3문장 작성하세요.
- sentiment는 summary가 아닌 제목, 본문, 댓글 원문 전체를 직접 근거로 판단하세요.
- sentiment는 아래 8개 중 하나만 사용하세요: {allowed_categories}
- 아이콘은 시스템에서 자동으로 붙이므로 sentiment에는 텍스트만 입력하세요.
{extra_prompt}

{{
  "summary": "게시글 내용과 댓글 반응을 2~3문장으로 요약",
  "sentiment": "광고 또는 장점 또는 단점 또는 추천 또는 비교 또는 정보공유 또는 대상아님 또는 기타"
}}

반드시 JSON만 출력하세요. 다른 설명, 마크다운, 코드블록은 출력하지 마세요.
"""

    def _parse_json(
        self,
        text: str,
        brand_mode: bool = False,
        source_text: str = "",
        target_region: str = "",
    ) -> Optional[Dict]:
        """AI 응답 JSON 파싱"""
        if not text:
            return None

        try:
            cleaned = text.strip()

            if "```json" in cleaned:
                cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0].strip()
            elif "```" in cleaned:
                cleaned = cleaned.split("```", 1)[1].split("```", 1)[0].strip()

            start = cleaned.find("{")
            end = cleaned.rfind("}")

            if start != -1 and end != -1 and end > start:
                cleaned = cleaned[start : end + 1]

            result = json.loads(cleaned)

            if not isinstance(result, dict):
                return None

            if "summary" not in result and "요약" in result:
                result["summary"] = result.get("요약")
            if "sentiment" not in result and "게시물유형" in result:
                result["sentiment"] = result.get("게시물유형")

            if "summary" not in result or "sentiment" not in result:
                return None

            result["summary"] = str(result.get("summary", "")).strip()
            result["sentiment"] = self._normalize_sentiment(
                str(result.get("sentiment", "")).strip(),
                brand_mode,
                source_text
            )
            mentioned = result.get("mentioned_academies")
            if mentioned is None:
                for key in ["언급학원", "언급 학원", "언급된학원", "언급된 학원", "학원명", "학원목록"]:
                    if key in result:
                        mentioned = result.get(key)
                        break
            if mentioned is None:
                mentioned = []
            if isinstance(mentioned, str):
                mentioned = mentioned.replace("，", ",").split(",")
            if not isinstance(mentioned, list):
                mentioned = []

            unique_academies = []
            seen = set()
            for academy in mentioned:
                name = str(academy).strip()
                normalized = name.lower().replace(" ", "")
                if name and normalized not in seen:
                    unique_academies.append(name)
                    seen.add(normalized)
            if result["sentiment"] in {"광고", "무관", "대상아님"}:
                unique_academies = []
            result["mentioned_academies"] = unique_academies
            result["region"] = self._normalize_region(
                result.get("region", result.get("지역", "")),
                target_region,
                source_text,
            )

            advantages = self._normalize_list(result.get("advantages", result.get("장점카테고리", [])))
            disadvantages = self._normalize_list(result.get("disadvantages", result.get("단점카테고리", [])))
            advantage_quotes = self._normalize_quotes(result.get("장점근거", {}))
            disadvantage_quotes = self._normalize_quotes(result.get("단점근거", {}))
            if result["sentiment"] in {"광고", "무관", "대상아님"}:
                result["region"] = ""
                advantages = []
                disadvantages = []
                advantage_quotes = {}
                disadvantage_quotes = {}
            if result["sentiment"] in {"무관", "대상아님"}:
                result["summary"] = ""

            result["advantages"] = advantages
            result["disadvantages"] = disadvantages
            result["advantage_quotes"] = advantage_quotes
            result["disadvantage_quotes"] = disadvantage_quotes

            raw_evals = result.get("학원별평가", {})
            if not isinstance(raw_evals, dict):
                raw_evals = {}
            academy_evaluations = {}
            for ac_name, eval_data in raw_evals.items():
                if not isinstance(eval_data, dict):
                    continue
                academy_evaluations[str(ac_name).strip()] = {
                    "장점카테고리": self._normalize_list(eval_data.get("장점카테고리", [])),
                    "장점근거": self._normalize_quotes(eval_data.get("장점근거", {})),
                    "단점카테고리": self._normalize_list(eval_data.get("단점카테고리", [])),
                    "단점근거": self._normalize_quotes(eval_data.get("단점근거", {})),
                }
            if result["sentiment"] in {"광고", "무관", "대상아님"}:
                academy_evaluations = {}
            result["academy_evaluations"] = academy_evaluations

            return result

        except Exception:
            return None

    def _normalize_list(self, value) -> List[str]:
        """AI의 배열 또는 쉼표 구분 문자열을 중복 없는 문자열 배열로 정리합니다."""
        if isinstance(value, str):
            value = value.replace("，", ",").split(",")
        if not isinstance(value, list):
            return []

        normalized_values = []
        seen = set()
        for item in value:
            text = str(item).strip()
            if text and text not in seen:
                normalized_values.append(text)
                seen.add(text)
        return normalized_values

    def _normalize_quotes(self, value) -> Dict:
        """AI의 태그→근거문구 딕셔너리를 정리합니다."""
        if not isinstance(value, dict):
            return {}
        return {str(k).strip(): str(v).strip() for k, v in value.items() if k and v}

    def _normalize_region(self, value, target_region: str, source_text: str) -> str:
        """AI 지역 응답을 검색설정 기준의 단일 지역명으로 정리합니다."""
        raw_region = str(value or "").strip()
        raw_target = str(target_region or "").strip()

        def split_regions(text: str) -> List[str]:
            parts = re.split(r"\s*(?:,|/|\||·|및|그리고)\s*", text)
            normalized = []
            for part in parts:
                name = part.strip()
                if not name:
                    continue
                name = re.sub(r"(?:특별시|광역시|특별자치시|특별자치도|도|시|군|구)$", "", name).strip()
                if name and name not in normalized:
                    normalized.append(name)
            return normalized

        target_candidates = split_regions(raw_target)
        ai_candidates = split_regions(raw_region)
        source = source_text or ""
        known_regions = [
            "광진", "성동", "동대문", "중랑", "송파", "강동", "강남", "서초",
            "노원", "도봉", "강북", "성북", "종로", "중구", "용산", "마포",
            "서대문", "은평", "양천", "강서", "구로", "금천", "영등포", "동작",
            "관악", "하남", "구리", "남양주", "성남", "광주", "부천",
        ]
        detected = [(source.count(region), region) for region in known_regions]
        detected.sort(key=lambda item: item[0], reverse=True)
        detected = [item for item in detected if item[0] > 0]

        if detected:
            top_count = detected[0][0]
            top_regions = [region for count, region in detected if count == top_count]
            for ai_region in ai_candidates:
                for region in top_regions:
                    if region in ai_region or ai_region in region:
                        return region
            return top_regions[0]

        if ai_candidates:
            return ai_candidates[0]

        return target_candidates[0] if target_candidates else ""

    def _normalize_sentiment(self, sentiment: str, brand_mode: bool = False, source_text: str = "") -> str:
        """감성값 정규화"""
        if "광고" in sentiment or "홍보" in sentiment:
            return "광고"

        if "무관" in sentiment:
            return "무관"
        if "후기" in sentiment:
            return "후기"
        if "질문" in sentiment or "문의" in sentiment:
            return "질문"
        if sentiment.strip() == "정보":
            return "정보"

        if "대상아님" in sentiment or "대상 아님" in sentiment or "비대상" in sentiment:
            return "대상아님"

        if "자사비교" in sentiment or "자사 비교" in sentiment or "브랜드비교" in sentiment or "브랜드 비교" in sentiment:
            if not self._has_owned_brand(source_text):
                if any(token in source_text for token in ["추천", "어디", "보내", "다니", "만족", "좋"]):
                    return "경쟁학원 추천"
                return "경쟁학원 중립"
            return "자사비교"
        if "경쟁학원" in sentiment:
            if "부정" in sentiment or "단점" in sentiment:
                return "경쟁학원 부정"
            if "긍정" in sentiment or "장점" in sentiment:
                return "경쟁학원 긍정"
            if "추천" in sentiment:
                return "경쟁학원 추천"
            if "중립" in sentiment:
                return "경쟁학원 중립"

        if "장점" in sentiment or "긍정" in sentiment:
            return "장점"
        if "단점" in sentiment or "부정" in sentiment:
            return "단점"
        if "추천" in sentiment or "학원추천" in sentiment:
            return "추천"
        if "비교" in sentiment:
            return "비교"
        if "정보공유" in sentiment or "정보" in sentiment:
            return "정보공유"
        if "기타" in sentiment:
            return "기타"

        return "기타"

    def _add_emoji(self, sentiment: str) -> str:
        """감성에 이모지 추가"""
        emoji_map = {
            "후기": "📝 후기",
            "질문": "❓ 질문",
            "정보": "ℹ️ 정보",
            "무관": "⛔ 무관",
            "장점": "😊 장점",
            "단점": "😢 단점",
            "추천": "🎓 추천",
            "비교": "⚖️ 비교",
            "경쟁학원 긍정": "😊 경쟁학원 긍정",
            "경쟁학원 부정": "😢 경쟁학원 부정",
            "경쟁학원 중립": "😐 경쟁학원 중립",
            "경쟁학원 추천": "🎓 경쟁학원 추천",
            "자사비교": "⚖️ 자사비교",
            "정보공유": "ℹ️ 정보공유",
            "대상아님": "🚫 대상아님",
            "광고": "📢 광고",
            "기타": "📌 기타",
        }
        return emoji_map.get(sentiment, "📌 기타")

    def _empty_result(self) -> Dict:
        """빈 결과 반환"""
        return {
            "summary": "",
            "sentiment": "",
            "sentiment_emoji": "",
            "mentioned_academies": [],
            "region": "",
            "advantages": [],
            "disadvantages": [],
            "advantage_quotes": {},
            "disadvantage_quotes": {},
            "academy_evaluations": {},
            "ai_model": "",
        }

    def print_stats(self):
        """AI 사용 통계 출력"""
        gemini_total = sum(self.stats["gemini"].values())
        claude_total = sum(self.stats["claude"].values())
        failed_total = self.stats["failed"]
        total = gemini_total + claude_total + failed_total

        if total == 0:
            return

        print("\n[AI 사용 통계]")

        if self.stats["ad"] > 0:
            print(f"  광고 판별: {self.stats['ad']}회")

        if self.stats["pattern_match"] > 0:
            print(f"  패턴 광고 처리: {self.stats['pattern_match']}회")

        if gemini_total > 0:
            print(f"\n  [Gemini] 총 {gemini_total}회")
            for key, count in self.stats["gemini"].items():
                print(f"    - {key}: {count}회 ({count / total * 100:.1f}%)")

        if claude_total > 0:
            print(f"\n  [Claude] 총 {claude_total}회")
            for key, count in self.stats["claude"].items():
                print(f"    - {key}: {count}회 ({count / total * 100:.1f}%)")

        if failed_total > 0:
            print(f"\n  실패: {failed_total}회 ({failed_total / total * 100:.1f}%)")
