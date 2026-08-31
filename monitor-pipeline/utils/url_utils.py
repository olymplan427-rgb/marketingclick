"""
게시글 URL 정규화/중복판정 유틸리티
naver-cafe-keyword-monitor/sheets/duplicate_checker.py 에서 구글시트 의존 부분을 제거하고 순수 함수만 추출.
"""

import html
import re
from urllib.parse import parse_qs, unquote, urlsplit, urlunsplit


def normalize_article_url(url: str) -> str:
    """네이버 카페 게시글 URL을 중복 비교용 키로 정규화합니다."""
    raw_url = html.unescape((url or '').strip())
    if not raw_url:
        return ''

    if '://' not in raw_url:
        raw_url = f'https://{raw_url.lstrip("/")}'

    try:
        parsed = urlsplit(raw_url)
        host = parsed.netloc.lower().split('@')[-1]
        if host in {'m.cafe.naver.com', 'cafe.naver.com'}:
            host = 'cafe.naver.com'

        path = re.sub(r'/+', '/', unquote(parsed.path or '')).rstrip('/')
        query = parse_qs(parsed.query)

        club_id = next(iter(query.get('clubid', query.get('clubId', []))), '')
        article_id = next(iter(query.get('articleid', query.get('articleId', []))), '')
        if club_id and article_id:
            return f'naver-cafe:{club_id}:{article_id}'

        cafe_id_match = re.search(
            r'/(?:f-e|ca-fe)/cafes/(\d+)/(?:articles|article)/(\d+)',
            path,
            re.IGNORECASE,
        )
        if cafe_id_match:
            return f'naver-cafe:{cafe_id_match.group(1)}:{cafe_id_match.group(2)}'

        slug_match = re.fullmatch(r'/([^/]+)/(\d+)', path)
        if host == 'cafe.naver.com' and slug_match:
            return f'naver-cafe:{slug_match.group(1).lower()}:{slug_match.group(2)}'

        return urlunsplit(('https', host, path, '', ''))
    except Exception:
        return raw_url.split('#', 1)[0].split('?', 1)[0].rstrip('/')


def make_post_key(url: str) -> str:
    """검색어와 관계없이 게시글 URL만으로 중복 판정 키를 만듭니다."""
    return normalize_article_url(url)
