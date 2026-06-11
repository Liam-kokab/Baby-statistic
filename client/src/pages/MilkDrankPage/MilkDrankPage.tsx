import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetch2 } from 'baby-statistic-common/util';
import type { TDrankMilk, TDrankMilkSource, TDrankMilkSummary, TWishedResult } from 'baby-statistic-common';
import PageLayout from '../../components/PageLayout/PageLayout';
import DateRangeFilter from '../../components/DateRangeFilter/DateRangeFilter';
import type { TView } from '../../components/DateRangeFilter/DateRangeFilter';
import Button from '../../components/Button/Button';
import { groupByDay } from '../../utils/groupByDay';
import { groupByWeek } from '../../utils/groupByWeek';
import { formatTime, formatDateTime, formatDateWithWeekday } from '../../utils/format';
import useRefetchOnVisible from '../../utils/useRefetchOnVisible';
import useTimeWindowScroll, { getWindowEnd } from '../../utils/useInfiniteScroll';
import { hasEnoughForView } from '../../utils/hasEnoughForView';
import styles from './MilkDrankPage.module.css';

const getTopCardAgeClass = (createdAt: string): string => {
  const ageMin = (Date.now() - new Date(createdAt).getTime()) / 60_000;
  if (ageMin < 90) return 'cardGreen';
  if (ageMin < 120) return 'cardYellow';
  return '';
};

const sourceEmoji = (source: TDrankMilkSource): string => {
  if (source === 'FRIDGE') return '🧊';
  if (source === 'FREEZER') return '❄️';
  return '🤱';
};

const hasBoob = (items: TDrankMilk[]): boolean => items.some((i) => i.source === 'BOOB');

const getDefaultFrom = (): string => {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d.toISOString().slice(0, 10);
};

const getDefaultTo = (): string => getWindowEnd(new Date().toISOString().slice(0, 10));

const MilkDrankPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const from = searchParams.get('from') ?? getDefaultFrom();
  const to   = searchParams.get('to')   ?? getDefaultTo();
  const view = (searchParams.get('view') ?? 'item') as TView;

  const setFrom = (v: string) => setSearchParams((p) => { p.set('from', v); return p; });
  const setTo   = (v: string) => setSearchParams((p) => { p.set('to',   v); return p; });
  const setView = (v: TView)  => setSearchParams((p) => { p.set('view', v); return p; });

  const [summary, setSummary] = useState<TDrankMilkSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openDays,  setOpenDays]  = useState<Set<string>>(new Set());
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(new Set());

  const loadSummary = useCallback(async (): Promise<void> => {
    const params = new URLSearchParams({ from: `${from}T00:00:00`, to: `${to}T23:59:59` });
    const result = await fetch2<TDrankMilkSummary>(`/api/drank-milk/summary?${params}`);
    if (result.ok) setSummary(result.data);
  }, [from, to]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const fetchWindow = useCallback(async (winFrom: string, winTo: string): Promise<TWishedResult<TDrankMilk>> => {
    setError(null);
    const params = new URLSearchParams({ from: winFrom, to: winTo, wished: '50' });
    const result = await fetch2<TWishedResult<TDrankMilk>>(`/api/drank-milk?${params}`);
    if (result.ok) return result.data;
    setError(result.error);
    return { items: [], actualFrom: winFrom.slice(0, 10) };
  }, []);

  const hasEnough = useCallback(
    (items: TDrankMilk[]) => hasEnoughForView(items, view, (i) => i.createdAt),
    [view],
  );

  const { data, loading, hasMore, sentinelRef, refresh } = useTimeWindowScroll(from, to, fetchWindow, hasEnough);

  const visibilityRef = useRefetchOnVisible(() => { loadSummary(); refresh(); });

  const toggleDay = (date: string): void =>
    setOpenDays((prev) => { const n = new Set(prev); n.has(date) ? n.delete(date) : n.add(date); return n; });

  const toggleWeek = (weekKey: string): void =>
    setOpenWeeks((prev) => { const n = new Set(prev); n.has(weekKey) ? n.delete(weekKey) : n.add(weekKey); return n; });

  const renderItemView = () => {
    const sentinelIdx = Math.max(0, data.length - 10);
    return (
      <div className={styles.list}>
        {data.length === 0 && !loading ? (
          <p className={styles.empty}>No records found 🍼</p>
        ) : (
          data.map((item, idx) => {
            const ageClass = idx === 0 ? getTopCardAgeClass(item.createdAt) : '';
            return (
              <div
                key={item.id}
                ref={idx === sentinelIdx ? sentinelRef : undefined}
                className={`${styles.card}${ageClass ? ` ${styles[ageClass]}` : ''}`}
              >
                <span className={styles.sourceEmoji}>{sourceEmoji(item.source)}</span>
                <span className={styles.amount}>{item.amount} ml</span>
                <span className={styles.date}>{formatDateTime(item.createdAt)}</span>
                <Button emoji="✏️" variant="ghost" className={styles.editBtn} onClick={() => navigate(`/drank-milk/${item.id}`)} />
              </div>
            );
          })
        )}
        {loading ? <p className={styles.loadingMsg}>Loading… ⏳</p> : null}
        {!hasMore && data.length > 0 && !loading ? <p className={styles.endMsg}>All {data.length} records loaded</p> : null}
      </div>
    );
  };

  const renderDayView = () => {
    const groups = groupByDay(data);
    return (
      <div className={styles.list}>
        {groups.length === 0 && !loading ? (
          <p className={styles.empty}>No records found 🍼</p>
        ) : (
          groups.map(({ date, items }, idx) => {
            const dayTotal = items.reduce((sum, i) => sum + i.amount, 0);
            const dayHasBoob = hasBoob(items);
            const isOpen = openDays.has(date);
            const isSentinel = idx === Math.max(0, groups.length - 10);
            return (
              <div key={date} ref={isSentinel && hasMore ? sentinelRef : undefined} className={styles.dayGroup}>
                <div className={styles.dayHeader} onClick={() => toggleDay(date)}>
                  <span><span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>{'>'}</span>{' '}📅 {formatDateWithWeekday(date)}</span>
                  <span className={styles.dayTotal}>{dayTotal}{dayHasBoob ? '*' : ''} ml</span>
                </div>
                {isOpen ? (
                  items.map((item) => (
                    <div key={item.id} className={styles.dayItem}>
                      <span className={styles.dayItemSource}>{sourceEmoji(item.source)}</span>
                      <span className={styles.dayItemAmount}>{item.amount} ml</span>
                      <span className={styles.time}>{formatTime(item.createdAt)}</span>
                    </div>
                  ))
                ) : null}
              </div>
            );
          })
        )}
        {loading ? <p className={styles.loadingMsg}>Loading… ⏳</p> : null}
        {!hasMore && groups.length > 0 && !loading ? <p className={styles.endMsg}>Scroll up to load earlier weeks</p> : null}
      </div>
    );
  };

  const renderWeekView = () => {
    const weeks = groupByWeek(data);
    return (
      <div className={styles.list}>
        {weeks.length === 0 && !loading ? (
          <p className={styles.empty}>No records found 🍼</p>
        ) : (
          weeks.map(({ weekKey, weekLabel, days }, idx) => {
            const weekTotal  = days.reduce((sum, { items }) => sum + items.reduce((s, i) => s + i.amount, 0), 0);
            const weekAvg    = Math.round(weekTotal / 7);
            const weekHasBoob = days.some(({ items }) => hasBoob(items));
            const isWeekOpen = openWeeks.has(weekKey);
            const isLast = idx === weeks.length - 1;
            return (
              <div key={weekKey} ref={isLast && hasMore ? sentinelRef : undefined} className={styles.weekGroup}>
                <div className={styles.weekHeader} onClick={() => toggleWeek(weekKey)}>
                  <span><span className={`${styles.chevron} ${isWeekOpen ? styles.chevronOpen : ''}`}>{'>'}</span>{' '}📆 {weekLabel}</span>
                  <div className={styles.weekStats}>
                    <span className={styles.weekTotal}>{weekTotal}{weekHasBoob ? '*' : ''} ml</span>
                    <span className={styles.weekAvg}>~{weekAvg}{weekHasBoob ? '*' : ''} ml/day</span>
                  </div>
                </div>
                {isWeekOpen ? (
                  days.map(({ date, items }) => {
                    const dayTotal = items.reduce((sum, i) => sum + i.amount, 0);
                    const dayHasBoob = hasBoob(items);
                    const isDayOpen = openDays.has(date);
                    return (
                      <div key={date} className={styles.dayGroup}>
                        <div className={styles.dayHeader} onClick={() => toggleDay(date)}>
                          <span><span className={`${styles.chevron} ${isDayOpen ? styles.chevronOpen : ''}`}>{'>'}</span>{' '}📅 {formatDateWithWeekday(date, false)}</span>
                          <span className={styles.dayTotal}>{dayTotal}{dayHasBoob ? '*' : ''} ml</span>
                        </div>
                        {isDayOpen ? (
                          items.map((item) => (
                            <div key={item.id} className={styles.dayItem}>
                              <span className={styles.dayItemSource}>{sourceEmoji(item.source)}</span>
                              <span className={styles.dayItemAmount}>{item.amount} ml</span>
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
        {loading ? <p className={styles.loadingMsg}>Loading… ⏳</p> : null}
        {!hasMore && weeks.length > 0 && !loading ? <p className={styles.endMsg}>All weeks loaded</p> : null}
      </div>
    );
  };

  return (
    <div ref={visibilityRef}>
    <PageLayout title="Milk Drank" emoji="🍼" gradient="green">
      <DateRangeFilter from={from} to={to} view={view} onFromChange={setFrom} onToChange={setTo} onViewChange={setView} />
      <div className={styles.statsBar}>
        <div className={styles.statChip}>🍼 Total: <strong>{summary ? `${summary.totalMl}${summary.hasBoob ? '*' : ''} ml` : '—'}</strong></div>
        <div className={styles.statChip}>📊 Avg/day: <strong>{summary ? `~${summary.avgPerDay}${summary.hasBoob ? '*' : ''} ml` : '—'}</strong></div>
      </div>
      {error ? (
        <p className={styles.errorMsg}>⚠️ {error}</p>
      ) : (
        <>
          {view === 'item' ? renderItemView() : view === 'day' ? renderDayView() : renderWeekView()}
        </>
      )}
    </PageLayout>
    </div>
  );
};

export default MilkDrankPage;
