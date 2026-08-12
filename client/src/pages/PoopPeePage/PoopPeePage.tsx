import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { authFetch } from '../../utils/authFetch';
import type { TNappySummary, TWishedResult } from 'baby-statistic-common';
import PageLayout from '../../components/PageLayout/PageLayout';
import DateRangeFilter from '../../components/DateRangeFilter/DateRangeFilter';
import type { TView } from '../../components/DateRangeFilter/DateRangeFilter';
import Button from '../../components/Button/Button';
import { groupByDay } from '../../utils/groupByDay';
import { groupByWeek } from '../../utils/groupByWeek';
import { formatTime, formatDateTime, formatDateWithWeekday } from '../../utils/format';
import useRefetchOnVisible from '../../utils/useRefetchOnVisible';
import useDataFreshness from '../../utils/useDataFreshness';
import useTimeWindowScroll from '../../utils/useInfiniteScroll';
import { hasEnoughForView } from '../../utils/hasEnoughForView';
import { useTranslation } from '../../i18n/i18n';
import styles from './PoopPeePage.module.css';

type TCombinedEvent = { id: number; type: 'pee' | 'poop'; createdAt: string };

const getDefaultFrom = (): string => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
};

const getDefaultTo = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d.toISOString().slice(0, 10);
};

const eventEmoji = (type: 'pee' | 'poop'): string => type === 'poop' ? '💩' : '💧';

const PoopPeePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const from = searchParams.get('from') ?? getDefaultFrom();
  const to   = searchParams.get('to')   ?? getDefaultTo();
  const view = (searchParams.get('view') ?? 'item') as TView;

  const setFrom = (v: string) => setSearchParams((p) => { p.set('from', v); return p; });
  const setTo   = (v: string) => setSearchParams((p) => { p.set('to',   v); return p; });
  const setView = (v: TView)  => setSearchParams((p) => { p.set('view', v); return p; });

  const [summary, setSummary] = useState<TNappySummary | null>(null);
  const [openDays,  setOpenDays]  = useState<Set<string>>(new Set());
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(new Set());
  const freshness = useDataFreshness();

  const loadSummary = useCallback(async (): Promise<void> => {
    const params = new URLSearchParams({ from: `${from}T00:00:00`, to: `${to}T23:59:59` });
    const result = await authFetch<TNappySummary>(`/api/nappy/summary?${params}`);
    if (result.ok) {
      setSummary(result.data);
      freshness.reportSuccess();
    } else {
      freshness.reportError();
    }
  }, [from, to]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const fetchWindow = useCallback(async (winFrom: string, winTo: string): Promise<TWishedResult<TCombinedEvent>> => {
    const params = new URLSearchParams({ from: winFrom, to: winTo, wished: '50' });
    const result = await authFetch<TWishedResult<TCombinedEvent>>(`/api/nappy/list?${params}`);
    if (result.ok) return result.data;
    return { items: [], actualFrom: winFrom.slice(0, 10) };
  }, []);

  const hasEnough = useCallback(
    (items: TCombinedEvent[]) => hasEnoughForView(items, view, (i) => i.createdAt),
    [view],
  );

  const { data, loading, hasMore, sentinelRef, refresh } = useTimeWindowScroll(from, to, fetchWindow, hasEnough);

  const visibilityRef = useRefetchOnVisible(() => { loadSummary(); refresh(); });

  const toggleDay = (date: string): void =>
    setOpenDays((prev) => { const n = new Set(prev); if (n.has(date)) n.delete(date); else n.add(date); return n; });

  const toggleWeek = (weekKey: string): void =>
    setOpenWeeks((prev) => { const n = new Set(prev); if (n.has(weekKey)) n.delete(weekKey); else n.add(weekKey); return n; });

  const renderItemView = () => {
    const sentinelIdx = Math.max(0, data.length - 10);
    return (
      <div className={styles.list}>
        {data.length === 0 && !loading ? (
          <p className={styles.empty}>{t('POOP_PEE_PAGE_NO_RECORDS')}</p>
        ) : (
          data.map((item, idx) => (
            <div key={`${item.type}-${item.id}`} ref={idx === sentinelIdx ? sentinelRef : undefined} className={styles.card}>
              <span className={styles.cardEmoji}>{eventEmoji(item.type)}</span>
              <span className={styles.eventType}>{item.type === 'poop' ? t('POOP_PEE_PAGE_POOP') : t('POOP_PEE_PAGE_PEE')}</span>
              <span className={styles.date}>{formatDateTime(item.createdAt)}</span>
              <Button emoji="✏️" variant="ghost" className={styles.editBtn} onClick={() => navigate(`/${item.type}/${item.id}`)} />
            </div>
          ))
        )}
        {loading ? <p className={styles.loadingMsg}>{t('COMMON_LOADING')}</p> : null}
        {!hasMore && data.length > 0 && !loading ? <p className={styles.endMsg}>{t('LIST_ALL_RECORDS_LOADED', { count: data.length })}</p> : null}
      </div>
    );
  };

  const renderDayView = () => {
    const groups = groupByDay(data);
    return (
      <div className={styles.list}>
        {groups.length === 0 && !loading ? (
          <p className={styles.empty}>{t('POOP_PEE_PAGE_NO_RECORDS')}</p>
        ) : (
          groups.map(({ date, items }, idx) => {
            const dayPoop = items.filter((i) => i.type === 'poop').length;
            const dayPee  = items.filter((i) => i.type === 'pee').length;
            const isOpen = openDays.has(date);
            const isSentinel = idx === Math.max(0, groups.length - 10);
            return (
              <div key={date} ref={isSentinel && hasMore ? sentinelRef : undefined} className={styles.dayGroup}>
                <div className={styles.dayHeader} onClick={() => toggleDay(date)}>
                  <span><span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>{'>'}</span>{' '}📅 {formatDateWithWeekday(date)}</span>
                  <span className={styles.dayTotal}>💩 {dayPoop} &nbsp;💧 {dayPee}</span>
                </div>
                {isOpen ? (
                  items.map((item) => (
                    <div key={`${item.type}-${item.id}`} className={styles.dayItem}>
                      <span className={styles.dayItemEmoji}>{eventEmoji(item.type)}</span>
                      <span className={styles.dayItemType}>{item.type === 'poop' ? t('POOP_PEE_PAGE_POOP') : t('POOP_PEE_PAGE_PEE')}</span>
                      <span className={styles.time}>{formatTime(item.createdAt)}</span>
                    </div>
                  ))
                ) : null}
              </div>
            );
          })
        )}
        {loading ? <p className={styles.loadingMsg}>{t('COMMON_LOADING')}</p> : null}
        {!hasMore && groups.length > 0 && !loading ? <p className={styles.endMsg}>{t('LIST_ALL_DAYS_LOADED')}</p> : null}
      </div>
    );
  };

  const renderWeekView = () => {
    const weeks = groupByWeek(data);
    return (
      <div className={styles.list}>
        {weeks.length === 0 && !loading ? (
          <p className={styles.empty}>{t('POOP_PEE_PAGE_NO_RECORDS')}</p>
        ) : (
          weeks.map(({ weekKey, weekLabel, days }, idx) => {
            const weekPoop   = days.reduce((s, { items }) => s + items.filter((i) => i.type === 'poop').length, 0);
            const weekPee    = days.reduce((s, { items }) => s + items.filter((i) => i.type === 'pee').length, 0);
            const avgPoop    = (weekPoop / days.length).toFixed(1);
            const avgPee     = (weekPee  / days.length).toFixed(1);
            const isWeekOpen = openWeeks.has(weekKey);
            const isLast = idx === weeks.length - 1;
            return (
              <div key={weekKey} ref={isLast && hasMore ? sentinelRef : undefined} className={styles.weekGroup}>
                <div className={styles.weekHeader} onClick={() => toggleWeek(weekKey)}>
                  <span><span className={`${styles.chevron} ${isWeekOpen ? styles.chevronOpen : ''}`}>{'>'}</span>{' '}📆 {weekLabel}</span>
                  <div className={styles.weekStats}>
                    <span className={styles.weekTotal}>💩 {weekPoop} &nbsp;💧 {weekPee}</span>
                    <span className={styles.weekAvg}>~{avgPoop}{t('LIST_PER_DAY')} &nbsp;~{avgPee}{t('LIST_PER_DAY')}</span>
                  </div>
                </div>
                {isWeekOpen ? (
                  days.map(({ date, items }) => {
                    const dayPoop = items.filter((i) => i.type === 'poop').length;
                    const dayPee  = items.filter((i) => i.type === 'pee').length;
                    const isDayOpen = openDays.has(date);
                    return (
                      <div key={date} className={styles.dayGroup}>
                        <div className={styles.dayHeader} onClick={() => toggleDay(date)}>
                          <span><span className={`${styles.chevron} ${isDayOpen ? styles.chevronOpen : ''}`}>{'>'}</span>{' '}📅 {formatDateWithWeekday(date, false)}</span>
                          <span className={styles.dayTotal}>💩 {dayPoop} &nbsp;💧 {dayPee}</span>
                        </div>
                        {isDayOpen ? (
                          items.map((item) => (
                            <div key={`${item.type}-${item.id}`} className={styles.dayItem}>
                              <span className={styles.dayItemEmoji}>{eventEmoji(item.type)}</span>
                              <span className={styles.dayItemType}>{item.type === 'poop' ? t('POOP_PEE_PAGE_POOP') : t('POOP_PEE_PAGE_PEE')}</span>
                              <span className={styles.time}>{formatTime(item.createdAt)}</span>
                            </div>
                          ))
                        ) : null}
                      </div>
                    );
                  })
                ) : null}
              </div>
            );
          })
        )}
        {loading ? <p className={styles.loadingMsg}>{t('COMMON_LOADING')}</p> : null}
        {!hasMore && weeks.length > 0 && !loading ? <p className={styles.endMsg}>{t('LIST_ALL_WEEKS_LOADED')}</p> : null}
      </div>
    );
  };

  return (
    <PageLayout title={t('POOP_PEE_PAGE_TITLE')} emoji="💩" gradient="amber" bannerSlug="poop-pee" ref={visibilityRef} dataFreshness={freshness}>
      <DateRangeFilter from={from} to={to} view={view} onFromChange={setFrom} onToChange={setTo} onViewChange={setView} />
      <div className={styles.statsBar}>
        <div className={styles.statChip}>{t('POOP_PEE_PAGE_POOP_STAT')} <strong>{summary ? summary.poopCount : t('COMMON_DASH')}</strong></div>
        <div className={styles.statChip}>{t('POOP_PEE_PAGE_PEE_STAT')} <strong>{summary ? summary.peeCount : t('COMMON_DASH')}</strong></div>
      </div>
      <>
        {view === 'item' ? renderItemView() : view === 'day' ? renderDayView() : renderWeekView()}
      </>
    </PageLayout>
  );
};

export default PoopPeePage;
