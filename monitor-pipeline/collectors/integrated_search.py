"""
네이버 카페 통합 검색 수집기
- 네이버 카페 검색 API 직접 호출
- 여러 카페의 게시글 한 번에 수집

naver-cafe-keyword-monitor/collectors/integrated_search.py 이식본.
구글시트 의존 없음 (existing_urls는 호출측이 set으로 직접 주입).
"""

import os
import re
import time
import requests
from typing import Dict, List
from urllib.parse import quote
from datetime import datetime
import pytz
from utils.url_utils import make_post_key


class IntegratedSearchCollector:
    def __init__(self, year: int, month: int):
        from utils.date_utils import get_month_range
        self.year = year
        self.month = month
        self.month_start, self.month_end = get_month_range(year, month)
        self.article_cache = {}
        self.http_session = requests.Session()
        self.search_delay_seconds = max(
            0.0,
            float(os.getenv('SEARCH_REQUEST_DELAY_SECONDS', '0.15')),
        )

    def collect(self, keyword: str, existing_urls: set = None) -> Dict:
        collect_started = time.monotonic()
        if existing_urls is None:
            existing_urls = set()

        posts = []
        errors = []

        try:
            search_started = time.monotonic()
            search_posts = self._search_with_api(keyword, existing_urls)
            posts.extend(search_posts)
            print(f"      통합검색 결과: {len(search_posts)}건 (중복 제외 후)")
        except Exception as e:
            errors.append({'cafe_link': 'N/A', 'stage': '통합검색', 'message': str(e)})
            print(f"      통합검색 오류: {e}")
        search_seconds = time.monotonic() - search_started

        if posts:
            playwright_started = time.monotonic()
            print(f"      수집된 게시글: {len(posts)}건")
            try:
                from collectors.playwright_scraper import scrape_integrated_articles
                print("      Playwright로 본문/댓글 수집 시작...")

                article_urls = list(dict.fromkeys(p['article_url'] for p in posts))
                uncached_urls = [url for url in article_urls if url not in self.article_cache]
                expected_comment_counts = {
                    post['article_url']: post.get('expected_comment_count')
                    for post in posts
                    if post.get('article_url') in uncached_urls
                }

                if uncached_urls:
                    batch_result = scrape_integrated_articles(
                        uncached_urls,
                        expected_comment_counts=expected_comment_counts,
                    )
                    results = batch_result.get('results', [])
                    timed_out_urls = batch_result.get('timed_out_urls', [])
                    if timed_out_urls:
                        errors.append({
                            'cafe_link': 'N/A',
                            'stage': '검색어 본문/댓글 제한시간',
                            'message': (
                                f'{len(timed_out_urls)}건 미완료 후 다음 검색어로 진행 / '
                                f'첫 URL: {timed_out_urls[0]}'
                            ),
                        })
                    for article_result in results:
                        if article_result.get('error'):
                            errors.append({
                                'cafe_link': 'N/A',
                                'stage': '게시글 본문/댓글 수집',
                                'message': (
                                    f"{article_result['error']} / "
                                    f"URL: {article_result.get('url', '')}"
                                ),
                            })
                else:
                    print(f"      본문/댓글 캐시 재사용: {len(article_urls)}건")
                    results = []

                url_to_data = {
                    url: self.article_cache[url]
                    for url in article_urls
                    if url in self.article_cache
                }
                new_data = {
                    r['url']: r
                    for r in results
                    if r and (r.get('content') or r.get('comments'))
                }
                url_to_data.update(new_data)
                self.article_cache.update(new_data)

                updated_count = 0
                for post in posts:
                    url = post['article_url']
                    if url in url_to_data:
                        article_data = url_to_data[url]
                        if article_data.get('member_count'):
                            post['member_count'] = article_data['member_count']
                        if article_data.get('content'):
                            post['content'] = article_data['content']
                        if article_data.get('comments'):
                            post['comment_content'] = '\n---\n'.join(article_data['comments'])
                        updated_count += 1

                print(f"      본문/댓글 업데이트: {updated_count}건")

                original_count = len(posts)
                posts = [
                    p for p in posts
                    if p.get('article_url') in url_to_data
                    and (
                        url_to_data[p['article_url']].get('content')
                        or url_to_data[p['article_url']].get('comments')
                    )
                ]
                print(f"      제목만 수집된 게시글 제외: 전체 {original_count}건 -> 본문/댓글 수집 가능 {len(posts)}건 최종 유지")

            except Exception as e:
                errors.append({'cafe_link': 'N/A', 'stage': 'Playwright 수집', 'message': str(e)})
                print(f"      ❌ 본문 수집 오류: {e}")
            finally:
                print(f"      [소요시간] Playwright: {time.monotonic() - playwright_started:.1f}초")
        else:
            print("      수집된 게시글이 없어 Playwright 단계 건너뜀")

        print(
            f"      [소요시간] 통합검색 API {search_seconds:.1f}초"
            f" / 조건전체 {time.monotonic() - collect_started:.1f}초"
        )

        return {'posts': posts, 'errors': errors, 'total_count': len(posts)}

    def _search_with_api(self, keyword: str, existing_urls: set = None) -> List[Dict]:
        if existing_urls is None:
            existing_urls = set()

        posts = []
        seen_urls = set()
        base_url = "https://apis.cafe.naver.com/search/v1.0/section/search/articles"

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Accept': 'application/json, text/plain, */*',
            'Referer': f'https://section.cafe.naver.com/ca-fe/home/search/articles?q={quote(keyword)}',
            'X-Cafe-Product': 'mweb',
        }

        page = 1
        max_pages = 10
        stop_searching = False

        while page <= max_pages and not stop_searching:
            params = {
                'query': keyword,
                'sortBy': 1,
                'page': page,
                'size': 30
            }

            try:
                print(f"        API 호출 중... (페이지 {page}) [정렬: 최신순]")
                resp = self._get_with_backoff(
                    base_url,
                    params=params,
                    headers=headers,
                    timeout=15,
                )
                if resp.status_code != 200: break

                data = resp.json()
                if not data.get('result') or not data['result'].get('articleList'): break

                article_list = data['result']['articleList']

                for article_obj in article_list:
                    if article_obj.get('type') != 'ARTICLE': continue
                    article = article_obj.get('item')
                    if not article: continue

                    post = self._parse_api_article(article, keyword)
                    if not post: continue

                    try:
                        date_obj = datetime.strptime(post['write_date'], '%Y-%m-%d')
                        month_start_naive = self.month_start.replace(tzinfo=None)
                        month_end_naive = self.month_end.replace(tzinfo=None)

                        if date_obj > month_end_naive:
                            continue
                        elif date_obj < month_start_naive:
                            print(f"        [STOP] 탐색 중단: 타겟 월({self.month}월) 이전 글 발견 -> {post['write_date']}")
                            stop_searching = True
                            break
                        else:
                            article_url = post['article_url']

                            post_key = make_post_key(article_url)
                            if post_key in existing_urls:
                                continue

                            if post_key not in seen_urls:
                                seen_urls.add(post_key)
                                posts.append(post)
                    except Exception:
                        continue

                if len(article_list) < 10: break
                page += 1
                if self.search_delay_seconds:
                    time.sleep(self.search_delay_seconds)

            except Exception:
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

    def _parse_api_article(self, article: Dict, keyword: str) -> Dict:
        try:
            cafe_name = article.get('cafeName', '')
            cafe_url = article.get('cafeUrl', '')
            article_id = str(article.get('articleId', ''))
            title = article.get('subject', '')

            write_date = ''
            write_date_str = article.get('writeDate', '')
            if write_date_str:
                m = re.match(r'(\d{4})\.(\d{1,2})\.(\d{1,2})', write_date_str)
                if m:
                    year, month, day = m.groups()
                    write_date = f"{year}-{month.zfill(2)}-{day.zfill(2)}"

            if not write_date:
                now = datetime.now(pytz.timezone('Asia/Seoul'))
                write_date = now.strftime('%Y-%m-%d')

            snippet = article.get('content', '')
            article_url = article.get('linkUrl', '')

            if not article_url and cafe_url and article_id:
                cafe_url_full = f"https://cafe.naver.com/{cafe_url}" if not cafe_url.startswith('http') and not cafe_url.startswith('/') else (f"https://cafe.naver.com{cafe_url}" if cafe_url.startswith('/') else cafe_url)
                article_url = f"{cafe_url_full}/{article_id}"

            if not article_url: return None

            cafe_link_match = re.match(r'(https://cafe\.naver\.com/[^/]+)', article_url)
            cafe_link = cafe_link_match.group(1) if cafe_link_match else ''

            return {
                'cafe_name': cafe_name, 'member_count': 0, 'cafe_link': cafe_link,
                'search_target': '통합검색', 'keyword': keyword, 'write_date': write_date,
                'title': title, 'content': snippet, 'comment_content': '', 'article_url': article_url,
                'expected_comment_count': self._extract_comment_count(article),
            }
        except Exception: return None

    @staticmethod
    def _extract_comment_count(article: Dict):
        """통합검색 API가 명시적으로 제공한 댓글 수만 사용합니다."""
        for key in ('commentCount', 'commentCnt', 'comment_count', 'replyCount'):
            value = article.get(key)
            if isinstance(value, bool) or isinstance(value, dict) or value in (None, ''):
                continue
            try:
                return max(0, int(str(value).replace(',', '').strip()))
            except Exception:
                continue
        return None
