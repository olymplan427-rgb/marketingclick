"""
Playwright를 사용한 본문/댓글 수집기
- 실행 전체에서 Chromium 재사용
- 게시글 제한 병렬 수집
- 댓글 0건이 확인된 글은 본문 로딩 후 조기 종료

naver-cafe-keyword-monitor/collectors/playwright_scraper.py 이식본 (수정 없음, 구글시트 의존 없음).
"""

import atexit
import asyncio
import os
import re
from typing import Dict, Optional

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright


class PlaywrightScraper:
    def __init__(self):
        self.playwright = None
        self.browser = None
        self.context = None
        self.article_wait_ms = int(os.getenv("ARTICLE_WAIT_MS", "6000"))
        self.article_fallback_wait_ms = int(os.getenv("ARTICLE_FALLBACK_WAIT_MS", "4000"))
        self.article_poll_ms = int(os.getenv("ARTICLE_POLL_MS", "500"))
        self.article_concurrency = max(1, int(os.getenv("ARTICLE_CONCURRENCY", "2")))
        self.article_hard_timeout_seconds = max(
            30,
            int(os.getenv("ARTICLE_HARD_TIMEOUT_SECONDS", "90")),
        )
        self.frame_content_timeout_seconds = max(
            3,
            int(os.getenv("FRAME_CONTENT_TIMEOUT_SECONDS", "10")),
        )
        self.keyword_timeout_seconds = max(
            self.article_hard_timeout_seconds,
            int(os.getenv("KEYWORD_PLAYWRIGHT_TIMEOUT_SECONDS", "900")),
        )

    async def start(self):
        if self.browser and self.browser.is_connected() and self.context:
            return self

        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-dev-shm-usage'],
        )
        self.context = await self.browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        )
        await self.context.route("**/*", self._block_unneeded_resources)
        print(f"      Playwright 공유 브라우저 시작 (동시 수집 {self.article_concurrency}개)")
        return self

    async def close(self):
        context, browser, playwright = self.context, self.browser, self.playwright
        self.context = None
        self.browser = None
        self.playwright = None

        try:
            if context:
                await context.close()
        except Exception:
            pass
        try:
            if browser:
                await browser.close()
        except Exception:
            pass
        try:
            if playwright:
                await playwright.stop()
        except Exception:
            pass

    async def _block_unneeded_resources(self, route):
        if route.request.resource_type in {"image", "media", "font", "stylesheet"}:
            await route.abort()
            return
        await route.continue_()

    async def scrape_member_count(self, cafe_url: str) -> int:
        page = None
        try:
            page = await self.context.new_page()
            await page.goto(cafe_url, wait_until='domcontentloaded', timeout=30000)
            await page.wait_for_timeout(1500)
            page_html = await asyncio.wait_for(
                page.content(),
                timeout=self.frame_content_timeout_seconds,
            )
            soup = BeautifulSoup(page_html, 'html.parser')

            for em in soup.find_all('em'):
                text = em.get_text().replace(',', '').replace('명', '').strip()
                numbers = re.findall(r'\d+', text)
                if numbers and int(numbers[0]) > 100:
                    return int(numbers[0])
            return 0
        except Exception as exc:
            print(f"      회원수 확인 실패: {exc}")
            return 0
        finally:
            if page:
                try:
                    await asyncio.wait_for(page.close(), timeout=5)
                except Exception:
                    pass

    async def scrape_article_content(
        self,
        article_url: str,
        expected_comment_count: Optional[int] = None,
    ) -> dict:
        page = None
        try:
            if not self.browser or not self.browser.is_connected():
                raise RuntimeError('Playwright 브라우저 연결이 끊어졌습니다')

            page = await self.context.new_page()
            print(f"      [DEBUG] 페이지 접속: {article_url}")
            await page.goto(article_url, wait_until='domcontentloaded', timeout=60000)
            print(f"      [DEBUG] DOM 로딩 완료: {article_url}")

            wait_budget_ms = self.article_fallback_wait_ms
            try:
                await page.wait_for_selector('iframe#cafe_main', state='attached', timeout=5000)
                wait_budget_ms = self.article_wait_ms
            except Exception:
                pass

            content, comments = await self._wait_for_article_parts(
                page,
                wait_budget_ms,
                expected_comment_count,
            )
            print(
                "      [DEBUG] 본문/댓글 로딩 완료"
                f" (예상댓글: {expected_comment_count if expected_comment_count is not None else '?'},"
                f" 수집댓글: {len(comments)})"
            )
            return {'content': content, 'comments': comments}
        except Exception as exc:
            error_text = str(exc).lower()
            if (
                not self.browser
                or not self.browser.is_connected()
                or 'closed' in error_text
                or 'target page' in error_text
            ):
                raise
            print(f"      게시글 접속 실패: {article_url} / {exc}")
            return {'content': '', 'comments': [], 'error': str(exc)}
        finally:
            if page:
                try:
                    await asyncio.wait_for(page.close(), timeout=5)
                except Exception:
                    pass

    async def _wait_for_article_parts(
        self,
        page,
        wait_budget_ms: int,
        expected_comment_count: Optional[int],
    ):
        """본문/댓글을 반복 확인하고 필요한 부분이 준비되면 상한 전에 반환"""
        loop = asyncio.get_running_loop()
        deadline = loop.time() + (wait_budget_ms / 1000)
        content = ''
        comments = []
        content_ready_polls = 0

        while True:
            content, comments = await self._extract_article_parts(page, content, comments)

            if content and comments:
                if expected_comment_count is None:
                    return content, comments
                if len(comments) >= max(1, expected_comment_count):
                    return content, comments

            if content and expected_comment_count == 0:
                content_ready_polls += 1
                if content_ready_polls >= 2:
                    return content, comments
            else:
                content_ready_polls = 0

            remaining_ms = int((deadline - loop.time()) * 1000)
            if remaining_ms <= 0:
                return content, comments

            await page.wait_for_timeout(min(self.article_poll_ms, remaining_ms))

    async def _extract_article_parts(self, page, content: str, comments: list):
        for frame in page.frames:
            frame_url = frame.url
            if not frame_url or frame_url == 'about:blank':
                continue

            try:
                frame_html = await asyncio.wait_for(
                    frame.content(),
                    timeout=self.frame_content_timeout_seconds,
                )
                soup = BeautifulSoup(frame_html, 'html.parser')

                if not content:
                    se_container = soup.find(class_='se-main-container')
                    if se_container:
                        content = '\n'.join([
                            p.get_text(strip=True)
                            for module in se_container.find_all(class_='se-module-text')
                            for p in module.find_all('p', class_='se-text-paragraph')
                            if p.get_text(strip=True) and p.get_text(strip=True) != '​'
                        ])

                if not content:
                    article_content = soup.find(class_='ArticleContentBox')
                    if article_content:
                        content = article_content.get_text(separator='\n', strip=True)

                if not comments:
                    extracted_comments = []
                    for item in soup.find_all(class_='CommentItem'):
                        comment_text_elem = (
                            item.find(class_='comment_text_box')
                            or item.find(class_='text_comment')
                        )
                        if comment_text_elem and comment_text_elem.get_text(strip=True):
                            extracted_comments.append(comment_text_elem.get_text(strip=True))
                    if extracted_comments:
                        comments = extracted_comments

                if content and comments:
                    break
            except Exception:
                continue

        return content, comments

    async def scrape_articles(
        self,
        article_urls: list,
        expected_comment_counts: Optional[Dict[str, Optional[int]]] = None,
    ) -> dict:
        semaphore = asyncio.Semaphore(self.article_concurrency)
        expected_comment_counts = expected_comment_counts or {}

        async def scrape_one(url):
            async with semaphore:
                try:
                    result = await asyncio.wait_for(
                        self.scrape_article_content(
                            url,
                            expected_comment_counts.get(url),
                        ),
                        timeout=self.article_hard_timeout_seconds,
                    )
                except asyncio.TimeoutError:
                    message = f'게시글 제한시간 {self.article_hard_timeout_seconds}초 초과'
                    print(f"      [TIMEOUT] {message}: {url}")
                    result = {'content': '', 'comments': [], 'error': message}
                await asyncio.sleep(0.1)
                return url, result

        tasks = {
            asyncio.create_task(scrape_one(url)): url
            for url in article_urls
        }
        done, pending = await asyncio.wait(
            tasks,
            timeout=self.keyword_timeout_seconds,
        )

        articles = {}
        fatal_error = None
        for task in done:
            try:
                url, result = task.result()
                articles[url] = result
            except Exception as exc:
                url = tasks[task]
                articles[url] = {
                    'content': '',
                    'comments': [],
                    'error': f'게시글 수집 오류: {exc}',
                }
                if not self.browser or not self.browser.is_connected():
                    fatal_error = exc

        timed_out_urls = [tasks[task] for task in pending]
        if timed_out_urls:
            print(
                f"      [TIMEOUT] 검색어 본문/댓글 수집 {self.keyword_timeout_seconds}초 초과"
                f" / 완료 {len(done)}건 / 미완료 {len(timed_out_urls)}건"
            )
            for task in pending:
                task.cancel()
            await asyncio.gather(*pending, return_exceptions=True)

        if fatal_error is not None:
            raise fatal_error

        return {
            'articles': articles,
            'timed_out_urls': timed_out_urls,
        }


class PersistentPlaywrightRunner:
    """동기 수집 코드에서 하나의 비동기 Playwright 세션을 재사용한다."""

    def __init__(self):
        self.loop = asyncio.new_event_loop()
        self.scraper = PlaywrightScraper()
        self.closed = False
        self.loop.run_until_complete(self.scraper.start())

    def _run_with_restart(self, operation_factory):
        try:
            return self.loop.run_until_complete(operation_factory(self.scraper))
        except Exception as exc:
            print(f"      Playwright 공유 브라우저 오류, 1회 재시작: {exc}")
            self.loop.run_until_complete(self.scraper.close())
            self.scraper = PlaywrightScraper()
            self.loop.run_until_complete(self.scraper.start())
            return self.loop.run_until_complete(operation_factory(self.scraper))

    def scrape_cafe(
        self,
        cafe_url: str,
        article_urls: list,
        member_count: int = 0,
        collect_member_count: bool = True,
        expected_comment_counts: Optional[Dict[str, Optional[int]]] = None,
    ) -> dict:
        async def operation(scraper):
            current_member_count = member_count
            if current_member_count > 0:
                print(f"      멤버수 재사용: {current_member_count}")
            elif collect_member_count:
                current_member_count = await scraper.scrape_member_count(cafe_url)
            else:
                print("      멤버수 확인 생략: 이 실행에서 이미 확인한 카페")

            batch = await scraper.scrape_articles(
                article_urls,
                expected_comment_counts,
            )
            return {
                'member_count': current_member_count,
                'articles': batch['articles'],
                'timed_out_urls': batch['timed_out_urls'],
            }

        return self._run_with_restart(operation)

    def scrape_integrated(
        self,
        article_urls: list,
        expected_comment_counts: Optional[Dict[str, Optional[int]]] = None,
    ) -> dict:
        async def operation(scraper):
            batch = await scraper.scrape_articles(
                article_urls,
                expected_comment_counts,
            )
            return {
                'results': [
                    {
                        'url': url,
                        'member_count': 0,
                        'content': data.get('content', ''),
                        'comments': data.get('comments', []),
                        'error': data.get('error', ''),
                    }
                    for url, data in batch['articles'].items()
                ],
                'timed_out_urls': batch['timed_out_urls'],
            }

        return self._run_with_restart(operation)

    def close(self):
        if self.closed:
            return
        self.closed = True
        try:
            self.loop.run_until_complete(self.scraper.close())
        finally:
            self.loop.close()


_SHARED_RUNNER = None


def get_shared_playwright_runner() -> PersistentPlaywrightRunner:
    global _SHARED_RUNNER
    if _SHARED_RUNNER is None or _SHARED_RUNNER.closed:
        _SHARED_RUNNER = PersistentPlaywrightRunner()
    return _SHARED_RUNNER


def close_shared_playwright_runner():
    global _SHARED_RUNNER
    if _SHARED_RUNNER is not None:
        _SHARED_RUNNER.close()
        _SHARED_RUNNER = None


def scrape_with_playwright(
    cafe_url: str,
    article_urls: list,
    member_count: int = 0,
    collect_member_count: bool = True,
    expected_comment_counts: Optional[Dict[str, Optional[int]]] = None,
) -> dict:
    return get_shared_playwright_runner().scrape_cafe(
        cafe_url,
        article_urls,
        member_count,
        collect_member_count,
        expected_comment_counts,
    )


def scrape_integrated_articles(
    article_urls: list,
    expected_comment_counts: Optional[Dict[str, Optional[int]]] = None,
) -> dict:
    return get_shared_playwright_runner().scrape_integrated(
        article_urls,
        expected_comment_counts,
    )


atexit.register(close_shared_playwright_runner)
