"""
온디맨드 경쟁학원 모니터링 수집 Job.

GitHub Actions workflow_dispatch로 실행되며, 완료되면 결과를 Cloudflare Worker의
콜백 엔드포인트(--callback-url)로 POST 한다. 구글시트를 전혀 사용하지 않는다.

사용 예:
  python collect_job.py --job-id abc123 --keyword 파인만 --region 광진 \
      --callback-url https://academymonitor.example.workers.dev/api/jobs/abc123/callback

필요 환경변수(GitHub Secrets로 주입):
  CALLBACK_SECRET               콜백 요청 인증용 공유 비밀 (Authorization: Bearer)
  GEMINI_API_KEY_4468 / _SS / _KIM   Gemini 폴백 키 (선택)
  CLAUDE_API_KEY 또는 ANTHROPIC_API_KEY  Claude 사용 시
  AI_PROVIDER                   gemini(기본) 또는 claude
"""

import argparse
import json
import os
import sys
import traceback

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from collectors.integrated_search import IntegratedSearchCollector
from collectors.cafe_collector import CafeCollector
from collectors.sentiment_analyzer import AIAnalyzer
from utils.date_utils import now_kst


def parse_args():
    parser = argparse.ArgumentParser(description="경쟁학원 모니터링 온디맨드 수집")
    parser.add_argument("--job-id", required=True)
    parser.add_argument("--keyword", required=True, help="검색할 학원명/키워드")
    parser.add_argument("--region", default="", help="타겟 지역 (참고값, AI가 원문 기준으로 재판단)")
    parser.add_argument("--mode", choices=["integrated", "cafe"], default="integrated")
    parser.add_argument("--cafe-link", default="", help="--mode cafe 일 때 대상 카페 URL")
    parser.add_argument("--year", type=int, default=now_kst().year)
    parser.add_argument("--month", type=int, default=now_kst().month)
    parser.add_argument("--callback-url", required=True)
    return parser.parse_args()


def post_callback(callback_url: str, payload: dict):
    secret = os.getenv("CALLBACK_SECRET", "")
    headers = {"Content-Type": "application/json"}
    if secret:
        headers["Authorization"] = f"Bearer {secret}"

    resp = requests.post(callback_url, headers=headers, data=json.dumps(payload), timeout=30)
    resp.raise_for_status()


def collect_posts(args) -> list:
    if args.mode == "cafe":
        if not args.cafe_link:
            raise ValueError("--mode cafe 에는 --cafe-link 가 필요합니다")
        collector = CafeCollector(args.year, args.month)
        result = collector.collect(args.cafe_link, args.keyword, existing_urls=set())
    else:
        collector = IntegratedSearchCollector(args.year, args.month)
        result = collector.collect(args.keyword, existing_urls=set())

    for error in result.get("errors", []):
        print(f"[수집 오류] {error}")

    return result.get("posts", [])


def analyze_posts(posts: list, keyword: str, target_region: str) -> list:
    analyzer = AIAnalyzer()
    results = []

    for i, post in enumerate(posts, 1):
        print(f"  [{i}/{len(posts)}] AI 분석 중... {post.get('article_url', '')}")
        analysis = analyzer.analyze(
            content=post.get("content", ""),
            comments=post.get("comment_content", ""),
            keyword=keyword,
            title=post.get("title", ""),
            target_region=target_region,
        )

        if analysis.get("sentiment") in {"", "광고", "무관", "대상아님"}:
            continue

        results.append({
            "article_url": post.get("article_url", ""),
            "cafe_name": post.get("cafe_name", ""),
            "write_date": post.get("write_date") or post.get("post_date", ""),
            "title": post.get("title", ""),
            "summary": analysis.get("summary", ""),
            "sentiment": analysis.get("sentiment", ""),
            "region": analysis.get("region", ""),
            "advantages": analysis.get("advantages", []),
            "disadvantages": analysis.get("disadvantages", []),
            "advantage_quotes": analysis.get("advantage_quotes", {}),
            "disadvantage_quotes": analysis.get("disadvantage_quotes", {}),
            "mentioned_academies": analysis.get("mentioned_academies", []),
            "academy_evaluations": analysis.get("academy_evaluations", {}),
            "ai_model": analysis.get("ai_model", ""),
        })

    analyzer.print_stats()
    return results


def main():
    args = parse_args()

    try:
        print(f"[JOB {args.job_id}] 수집 시작: 키워드='{args.keyword}' 지역='{args.region}' {args.year}-{args.month:02d}")
        posts = collect_posts(args)
        print(f"[JOB {args.job_id}] 수집 완료: {len(posts)}건, AI 분석 시작")
        results = analyze_posts(posts, args.keyword, args.region)
        print(f"[JOB {args.job_id}] AI 분석 완료: 유효 결과 {len(results)}건")

        post_callback(args.callback_url, {
            "job_id": args.job_id,
            "status": "done",
            "keyword": args.keyword,
            "region": args.region,
            "results": results,
        })
        print(f"[JOB {args.job_id}] 콜백 전송 완료")

    except Exception as exc:
        print(f"[JOB {args.job_id}] 실패: {exc}")
        traceback.print_exc()
        try:
            post_callback(args.callback_url, {
                "job_id": args.job_id,
                "status": "error",
                "error": str(exc),
            })
        except Exception as callback_exc:
            print(f"[JOB {args.job_id}] 오류 콜백 전송도 실패: {callback_exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
