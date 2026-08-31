"""
네이버 카페 수집기 (특정 카페 링크 대상)
- 제목 검색 + 댓글 검색
- Playwright로 본문/댓글 수집

naver-cafe-keyword-monitor/collectors/cafe_collector.py 이식본. 구글시트 의존 없음.
"""

import os
import re
import time
import requests
from typing import Dict, List
from bs4 import BeautifulSoup
from utils.url_utils import make_post_key


HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Origin': 'https://cafe.naver.com',
    'X-Cafe-Product': 'pc'
}


class CafeCollector:
    def __init__(
        self,
        year: int,
        month: int,
        member_count_cache: dict = None,
        cafe_id_cache: dict = None,
    ):
        from utils.date_utils import get_month_range
        self.year = year
        self.month = month
        self.month_start, self.month_end = get_month_range(year, month)
        self.member_count_cache = member_count_cache if member_count_cache is not None else {}
        self.cafe_id_cache = cafe_id_cache if cafe_id_cache is not None else {}
        self.article_cache = {}
        self.http_session = requests.Session()
        self.search_delay_seconds = max(
            0.0,
            float(os.getenv('SEARCH_REQUEST_DELAY_SECONDS', '0.15')),
        )
        self.search_date_from = self.month_start.strftime("%Y%m%d")
        self.search_date_to = self.month_end.strftime("%Y%m%d")
        print(f"  [특정카페 날짜검색] {self.search_date_from} ~ {self.search_date_to}")

    def collect(self, cafe_link: str, keyword: str, existing_urls: set = None) -> Dict:
        collect_started = time.monotonic()

        self.cafe_link = cafe_link
        self.cafe_slug = None

        m = re.search(r'cafe\.naver\.com/([^/?#]+)$', cafe_link)
        if m:
            slug = m.group(1)
            if slug not in ['f-e', 'cafes'] and not slug.isdigit():
                self.cafe_slug = slug

        cafe_id = self._extract_cafe_id(cafe_link)
        if not cafe_id:
            return {
                'posts': [],
                'errors': [{
                    'cafe_link': cafe_link,
                    'stage': 'cafeId 추출',
                    'message': 'cafeId 추출 실패'
                }],
                'title_count': 0,
                'comment_count': 0
            }

        if existing_urls is None:
            existing_urls = set()

        posts = []
        posts_by_url = {}
        errors = []
        seen_urls = set()

        title_search_started = time.monotonic()
        try:
            title_posts = self._search_cafe(cafe_id, keyword, 'SUBJECT', existing_urls, seen_urls)
            posts.extend(title_posts)
            posts_by_url.update({
                post['article_url']: post
                for post in title_posts
                if post.get('article_url')
            })
            title_count = len(title_posts)
        except Exception as e:
            errors.append({
                'cafe_link': cafe_link,
                'stage': '제목 검색',
                'message': str(e)
            })
            title_count = 0
        title_search_seconds = time.monotonic() - title_search_started

        if self.search_delay_seconds:
            time.sleep(self.search_delay_seconds)

        comment_search_started = time.monotonic()
        try:
            comment_posts = self._search_cafe(cafe_id, keyword, 'COMMENT', existing_urls, set())
            comment_count = len(comment_posts)

            for comment_post in comment_posts:
                article_url = comment_post.get('article_url')
                existing_post = posts_by_url.get(article_url)

                if existing_post:
                    comment_snippet = comment_post.get('comment_content', '')
                    if comment_snippet and not existing_post.get('comment_content'):
                        existing_post['comment_content'] = comment_snippet

                    comment_expected = comment_post.get('expected_comment_count')
                    if comment_expected is not None:
                        title_expected = existing_post.get('expected_comment_count')
                        existing_post['expected_comment_count'] = max(
                            title_expected or 0,
                            comment_expected,
                        )

                    if existing_post.get('search_target') == '맘카페(제목)':
                        existing_post['search_target'] = '맘카페(제목+댓글)'
                    continue

                posts.append(comment_post)
                if article_url:
                    posts_by_url[article_url] = comment_post
                    seen_urls.add(make_post_key(article_url))
        except Exception as e:
            errors.append({
                'cafe_link': cafe_link,
                'stage': '댓글 검색',
                'message': str(e)
            })
            comment_count = 0
        comment_search_seconds = time.monotonic() - comment_search_started

        if posts:
            playwright_started = time.monotonic()
            try:
                from collectors.playwright_scraper import scrape_with_playwright

                print("      Playwright로 본문/댓글 수집 중...")

                article_urls = list(dict.fromkeys(p['article_url'] for p in posts))
                uncached_urls = [url for url in article_urls if url not in self.article_cache]
                expected_comment_counts = {
                    post['article_url']: post.get('expected_comment_count')
                    for post in posts
                    if post.get('article_url') in uncached_urls
                }
                member_count_checked = cafe_id in self.member_count_cache
                known_member_count = self.member_count_cache.get(cafe_id, 0)
                if not known_member_count:
                    known_member_count = next(
                        (p.get('member_count', 0) for p in posts if p.get('member_count', 0)),
                        0
                    )
                if known_member_count > 0:
                    self.member_count_cache[cafe_id] = known_member_count

                if uncached_urls:
                    result = scrape_with_playwright(
                        cafe_link,
                        uncached_urls,
                        known_member_count,
                        collect_member_count=not member_count_checked,
                        expected_comment_counts=expected_comment_counts,
                    )
                else:
                    print(f"      본문/댓글 캐시 재사용: {len(article_urls)}건")
                    result = {
                        'member_count': known_member_count,
                        'articles': {},
                        'timed_out_urls': [],
                    }

                timed_out_urls = result.get('timed_out_urls', [])
                if timed_out_urls:
                    errors.append({
                        'cafe_link': cafe_link,
                        'stage': '검색어 본문/댓글 제한시간',
                        'message': (
                            f'{len(timed_out_urls)}건 미완료 후 다음 검색어로 진행 / '
                            f'첫 URL: {timed_out_urls[0]}'
                        ),
                    })

                for url, article_data in result.get('articles', {}).items():
                    if article_data.get('error'):
                        errors.append({
                            'cafe_link': cafe_link,
                            'stage': '게시글 본문/댓글 수집',
                            'message': f"{article_data['error']} / URL: {url}",
                        })

                member_count = result['member_count']
                articles = {
                    url: self.article_cache[url]
                    for url in article_urls
                    if url in self.article_cache
                }
                articles.update(result['articles'])
                successful_articles = {
                    url: data
                    for url, data in result['articles'].items()
                    if data.get('content') or data.get('comments')
                }
                self.article_cache.update(successful_articles)
                self.member_count_cache[cafe_id] = member_count

                for post in posts:
                    url = post['article_url']

                    if member_count > 0:
                        post['member_count'] = member_count

                    if url in articles:
                        article_data = articles[url]

                        if article_data['content']:
                            post['content'] = article_data['content']

                        if article_data['comments']:
                            post['comment_content'] = '\n---\n'.join(article_data['comments'])

                original_count = len(posts)
                posts = [
                    post for post in posts
                    if post['article_url'] in articles
                    and (
                        articles[post['article_url']].get('content')
                        or articles[post['article_url']].get('comments')
                    )
                ]
                print(f"      제목만 수집된 게시글 제외: 전체 {original_count}건 -> 본문/댓글 수집 가능 {len(posts)}건")

                print(f"      ✅ 멤버수: {member_count} / 본문 수집 완료")

            except Exception as e:
                print(f"      ⚠️ Playwright 오류: {e}")
                errors.append({
                    'cafe_link': cafe_link,
                    'stage': 'Playwright',
                    'message': str(e)
                })
            finally:
                print(f"      [소요시간] Playwright: {time.monotonic() - playwright_started:.1f}초")

        print(
            f"      [소요시간] 제목검색 {title_search_seconds:.1f}초"
            f" / 댓글검색 {comment_search_seconds:.1f}초"
            f" / 조건전체 {time.monotonic() - collect_started:.1f}초"
        )

        return {
            'posts': posts,
            'errors': errors,
            'title_count': title_count,
            'comment_count': comment_count
        }

    def _extract_cafe_id(self, url: str) -> str:
        """URL에서 cafeId 추출"""
        cache_key = (url or '').strip().rstrip('/')
        if cache_key in self.cafe_id_cache:
            return self.cafe_id_cache[cache_key]

        m = re.search(r'/cafes/(\d+)', url)
        if m:
            cafe_id = m.group(1)
            self.cafe_id_cache[cache_key] = cafe_id
            return cafe_id

        m = re.search(r'cafe\.naver\.com/([^/?#]+)$', url)
        if m:
            slug = m.group(1)
            cafe_id = self._fetch_cafe_id_from_slug(slug)
            if cafe_id:
                self.cafe_id_cache[cache_key] = cafe_id
            return cafe_id

        return ''

    def _fetch_cafe_id_from_slug(self, slug: str) -> str:
        """카페 slug에서 cafeId 조회"""
        url = f"https://cafe.naver.com/{slug}"
        try:
            resp = self._get_with_backoff(url, headers=HEADERS, timeout=15)
            html = resp.text

            m = re.search(r'cafes/(\d+)', html)
            if m:
                return m.group(1)

            m = re.search(r'"clubId"\s*:\s*"?(\d+)"?', html)
            if m:
                return m.group(1)

        except Exception:
            pass

        return ''

    def _search_cafe(
        self,
        cafe_id: str,
        keyword: str,
        search_by: str,
        existing_urls: set = None,
        seen_urls: set = None,
    ) -> List[Dict]:
        """
        네이버 카페 검색 API 호출

        Args:
            cafe_id: 카페 ID
            keyword: 검색 키워드
            search_by: SUBJECT(제목) 또는 COMMENT(댓글)
        """
        if existing_urls is None:
            existing_urls = set()
        if seen_urls is None:
            seen_urls = set()

        posts = []

        search_by_value = '1' if search_by == 'SUBJECT' else '4'
        search_target = '맘카페(제목)' if search_by == 'SUBJECT' else '맘카페(댓글)'
        debug_date_count = 0

        for page in range(1, 11):
            url = self._make_search_url(cafe_id, keyword, search_by_value, page)

            try:
                resp = self._get_with_backoff(url, headers={
                    **HEADERS,
                    'Referer': self._make_referer(cafe_id, keyword, search_by, page)
                }, timeout=15)

                if resp.status_code != 200:
                    break

                data = resp.json()

                if not data.get('result') or not data['result'].get('articleList'):
                    break

                member_count = 0
                if data['result'].get('cafe', {}).get('memberCount'):
                    member_count = data['result']['cafe']['memberCount']
                elif data['result'].get('cafeInfo', {}).get('memberCount'):
                    member_count = data['result']['cafeInfo']['memberCount']

                article_list = data['result']['articleList']

                if len(article_list) == 0:
                    break

                found_old = False

                for article in article_list:
                    item = article.get('item', {})

                    article_id = str(item.get('articleId', ''))
                    title = item.get('subject', '')

                    if not article_id or not title:
                        continue

                    add_date_raw = item.get('addDate', '')
                    post_date = self._parse_date(add_date_raw)

                    if debug_date_count < 2:
                        print(f"        [DEBUG] 작성일 원본: {add_date_raw} → 파싱: {post_date}")
                        debug_date_count += 1

                    if post_date:
                        from utils.date_utils import is_in_month_range, is_before_month

                        if not is_in_month_range(post_date, self.month_start, self.month_end):
                            if is_before_month(post_date, self.month_start):
                                found_old = True
                            continue

                    article_url = self._make_article_url(cafe_id, article_id)

                    post_key = make_post_key(article_url)
                    if post_key in existing_urls or post_key in seen_urls:
                        continue

                    seen_urls.add(post_key)

                    post = {
                        'search_target': search_target,
                        'post_date': post_date,
                        'title': title,
                        'content': item.get('summary', ''),
                        'comment_content': item.get('summary', '') if search_by == 'COMMENT' else '',
                        'article_url': article_url,
                        'article_id': article_id,
                        'member_count': member_count,
                        'expected_comment_count': self._extract_comment_count(item, search_by),
                    }

                    posts.append(post)

                if found_old:
                    break

                if self.search_delay_seconds:
                    time.sleep(self.search_delay_seconds)

            except Exception as e:
                print(f"      검색 API 오류 (page {page}): {e}")
                break

        return posts

    def _get_with_backoff(self, url: str, **kwargs):
        """정상 응답은 즉시 사용하고 제한/서버 오류일 때만 짧게 재시도합니다."""
        last_error = None
        for attempt in range(3):
            try:
                response = self.http_session.get(url, **kwargs)
                if response.status_code != 429 and response.status_code < 500:
                    return response
                last_error = RuntimeError(f'HTTP {response.status_code}')
            except requests.RequestException as exc:
                last_error = exc

            if attempt < 2:
                wait_seconds = attempt + 1
                print(f"      네이버 응답 지연, {wait_seconds}초 후 재시도: {last_error}")
                time.sleep(wait_seconds)

        if last_error:
            raise last_error
        raise RuntimeError('네이버 요청 실패')

    @staticmethod
    def _extract_comment_count(item: Dict, search_by: str):
        """검색 API 응답에서 댓글 수를 읽습니다. 댓글 검색 결과는 최소 1건입니다."""
        sources = [
            item,
            item.get('count', {}) if isinstance(item.get('count'), dict) else {},
            item.get('comment', {}) if isinstance(item.get('comment'), dict) else {},
        ]
        keys = ('commentCount', 'commentCnt', 'comment_count', 'replyCount')

        for source in sources:
            for key in keys:
                value = source.get(key)
                if isinstance(value, bool) or isinstance(value, dict) or value in (None, ''):
                    continue
                try:
                    return max(0, int(str(value).replace(',', '').strip()))
                except Exception:
                    continue

        return 1 if search_by == 'COMMENT' else None

    def _make_search_url(self, cafe_id: str, keyword: str, search_by: str, page: int) -> str:
        """검색 API URL 생성"""
        from urllib.parse import quote

        params = [
            f'query={quote(keyword)}',
            'perPage=15',
            f'page={page}',
            'menuId=0',
            f'searchBy={search_by}',
            f'writeTime.min={self.search_date_from}',
            f'writeTime.max={self.search_date_to}',
            'ad=false',
            'views=' + quote('MEMBER_LEVEL,COUNT,SALE_INFO,CAFE_MENU')
        ]

        return f"https://apis.cafe.naver.com/search/v2/cafes/{cafe_id}/search/articles?{'&'.join(params)}"

    def _make_referer(self, cafe_id: str, keyword: str, search_by: str, page: int) -> str:
        """Referer 헤더 생성"""
        from urllib.parse import quote

        ta = 'SUBJECT' if search_by == 'SUBJECT' else 'COMMENT'
        return f"https://cafe.naver.com/f-e/cafes/{cafe_id}/menus/0?viewType=L&ta={ta}&page={page}&q={quote(keyword)}&from={self.search_date_from}&to={self.search_date_to}"

    def _make_article_url(self, cafe_id: str, article_id: str) -> str:
        """게시글 URL 생성"""
        if hasattr(self, 'cafe_slug') and self.cafe_slug:
            return f"https://cafe.naver.com/{self.cafe_slug}/{article_id}"

        return f"https://cafe.naver.com/f-e/cafes/{cafe_id}/articles/{article_id}"

    def _parse_date(self, date_str: str) -> str:
        """날짜 파싱"""
        if not date_str:
            return ''

        m = re.match(r'^(\d{4})-(\d{2})-(\d{2})', date_str)
        if m:
            return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"

        return ''
