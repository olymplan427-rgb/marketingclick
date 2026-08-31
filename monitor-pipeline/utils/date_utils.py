"""
날짜 유틸리티
"""

from datetime import datetime, timedelta
import pytz


KST = pytz.timezone('Asia/Seoul')


def get_month_range(year: int, month: int):
    """
    월 범위 계산

    Returns:
        (month_start: datetime, month_end: datetime)
    """
    month_start = KST.localize(datetime(year, month, 1, 0, 0, 0))

    if month == 12:
        next_month = KST.localize(datetime(year + 1, 1, 1, 0, 0, 0))
    else:
        next_month = KST.localize(datetime(year, month + 1, 1, 0, 0, 0))

    month_end = next_month - timedelta(seconds=1)

    return month_start, month_end


def is_in_month_range(date_str: str, month_start: datetime, month_end: datetime) -> bool:
    """날짜가 월 범위 내인지 확인"""
    if not date_str:
        return False

    try:
        date = datetime.strptime(date_str, '%Y-%m-%d')
        date = KST.localize(date)
        return month_start <= date <= month_end
    except Exception:
        return False


def is_before_month(date_str: str, month_start: datetime) -> bool:
    """날짜가 월 범위 이전인지 확인"""
    if not date_str:
        return False

    try:
        date = datetime.strptime(date_str, '%Y-%m-%d')
        date = KST.localize(date)
        return date < month_start
    except Exception:
        return False


def format_ym(dt: datetime) -> str:
    """datetime을 YYYY-MM 형식으로"""
    return dt.strftime('%Y-%m')


def now_kst() -> datetime:
    """현재 KST 시각"""
    return datetime.now(KST)
