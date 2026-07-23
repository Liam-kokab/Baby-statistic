import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { authFetch } from '../../utils/authFetch';
import type { TServedMilk, TServedMilkTotal, TServedMilkStatus, TWishedResult } from 'baby-statistic-common';
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
import styles from './MilkSavedPage.module.css';

const STATUS_EMOJI: Record<TServedMilkStatus, string> = { FRIDGE: '🥛', FREEZER: '❄️', USED: '✅', EXPIRED: '⚠️' };
const ALL_STATUSES: TServedMilkStatus[] = ['FRIDGE', 'FREEZER', 'USED', 'EXPIRED'];

const getDefaultFrom = (): string => {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d.toISOString().slice(0, 10);
};

const getDefaultTo = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d.toISOString().slice(0, 10);
};

const MilkSavedPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const from = searchParams.get('from') ?? getDefaultFrom();
  const to   = searchParams.get('to')   ?? getDefaultTo();
  const view = (searchParams.get('view') ?? 'item') as TView;

  const setFrom = (v: string) => setSearchParams((p) => { p.set('from', v); return p; });
  const setTo   = (v: string) => setSearchParams((p) => { p.set('to',   v); return p; });
  const setView = (v: TView)  => setSearchParams((p) => { p.set('view', v); return p; });

  const [totals, setTotals] = useState<TServedMilkTotal>({ fridge: 0, freezer: 0, total: 0 });
  const [activeStatuses, setActiveStatuses] = useState<TServedMilkStatus[]>(['FRIDGE', 'FREEZER']);
  const [openDays,  setOpenDays]  = useState<Set<string>>(new Set());
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(new Set());

  const loadTotals = useCallback(async (): Promise<void> => {
    const result = await authFetch<TServedMilkTotal>('/api/served-milk/total');
    if (result.ok) setTotals(result.data);
  }, []);

  useEffect(() => { loadTotals(); }, [loadTotals]);

  const fetchWindow = useCallback(async (winFrom: string, winTo: string): Promise<TWishedResult<TServedMilk>> => {
    const params = new URLSearchParams({ from: winFrom, to: winTo, wished: '50' });
    const result = await authFetch<TWishedResult<TServedMilk>>(`/api/served-milk?${params}`);
    if (result.ok) return result.data;
    return { items: [], actualFrom: winFrom.slice(0, 10) };
  }, []);

  const hasEnough = useCallback(
    (items: TServedMilk[]) => hasEnoughForView(items, view, (i) => i.createdAt),
    [view],
  );

  const { data, loading, hasMore, sentinelRef, refresh } = useTimeWindowScroll(from, to, fetchWindow, hasEnough);

  const visibilityRef = useRefetchOnVisible(() => { loadTotals(); refresh(); });

  const toggleStatus = (status: TServedMilkStatus): void =>
    setActiveStatuses((prev) => prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]);

  const toggleDay = (date: string): void =>
    setOpenDays((prev) => { const n = new Set(prev); n.has(date) ? n.delete(date) : n.add(date); return n; });

  const toggleWeek = (weekKey: string): void =>
    setOpenWeeks((prev) => { const n = new Set(prev); n.has(weekKey) ? n.delete(weekKey) : n.add(weekKey); return n; });

  const filtered = data.filter((d) => activeStatuses.includes(d.status));

  const renderItemView = () => {
    const sentinelIdx = Math.max(0, filtered.length - 10);
    return (
      <div className={styles.list}>
        {filtered.length === 0 && !loading ? (
          <p className={styles.empty}>No records found 🧊</p>
        ) : (
          filtered.map((item, idx) => (
            <div key={item.id} ref={idx === sentinelIdx ? sentinelRef : undefined} className={styles.card}>
              <span className={styles.statusBadge}>{STATUS_EMOJI[item.status]} {item.status}</span>
              <span className={styles.amount}>{item.amount} / {item.originalAmount} ml</span>
              <span className={styles.date}>{formatDateTime(item.createdAt)}</span>
              <Button emoji="✏️" variant="ghost" className={styles.editBtn} onClick={() => navigate(`/stored-milk/${item.id}`)} />
            </div>
          ))
        )}
        {loading ? <p className={styles.loadingMsg}>Loading… ⏳</p> : null}
        {!hasMore && filtered.length > 0 && !loading ? <p className={styles.endMsg}>All {filtered.length} records loaded</p> : null}
      </div>
    );
  };

  const renderDayView = () => {
    const groups = groupByDay(filtered);
    return (
      <div className={styles.list}>
        {groups.length === 0 && !loading ? (
          <p className={styles.empty}>No records found 🧊</p>
        ) : (
          groups.map(({ date, items }, idx) => {
            const dayTotal = items.reduce((sum, i) => sum + i.amount, 0);
            const isOpen = openDays.has(date);
            const isSentinel = idx === Math.max(0, groups.length - 10);
            return (
              <div key={date} ref={isSentinel && hasMore ? sentinelRef : undefined} className={styles.dayGroup}>
                <div className={styles.dayHeader} onClick={() => toggleDay(date)}>
                  <span><span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>{'>'}</span>{' '}📅 {formatDateWithWeekday(date)}</span>
                  <span className={styles.dayTotal}>{dayTotal} ml</span>
                </div>
                {isOpen ? (
                  items.map((item) => (
                    <div key={item.id} className={styles.dayItem}>
                      <span className={styles.statusBadge}>{STATUS_EMOJI[item.status]} {item.status}</span>
                      <span className={styles.dayItemAmount}>{item.amount} / {item.originalAmount} ml</span>
                      <span className={styles.time}>{formatTime(item.createdAt)}</span>
                    </div>
                  ))
                ) : null}
              </div>
            );
          })
        )}
        {loading ? <p className={styles.loadingMsg}>Loading… ⏳</p> : null}
        {!hasMore && groups.length > 0 && !loading ? <p className={styles.endMsg}>All days loaded</p> : null}
      </div>
    );
  };

  const renderWeekView = () => {
    const weeks = groupByWeek(filtered);
    return (
      <div className={styles.list}>
        {weeks.length === 0 && !loading ? (
          <p className={styles.empty}>No records found 🧊</p>
        ) : (
          weeks.map(({ weekKey, weekLabel, days }, idx) => {
            const weekTotal  = days.reduce((sum, { items }) => sum + items.reduce((s, i) => s + i.amount, 0), 0);
            const weekAvg    = Math.round(weekTotal / 7);
            const isWeekOpen = openWeeks.has(weekKey);
            const isLast = idx === weeks.length - 1;
            return (
              <div key={weekKey} ref={isLast && hasMore ? sentinelRef : undefined} className={styles.weekGroup}>
                <div className={styles.weekHeader} onClick={() => toggleWeek(weekKey)}>
                  <span><span className={`${styles.chevron} ${isWeekOpen ? styles.chevronOpen : ''}`}>{'>'}</span>{' '}📆 {weekLabel}</span>
                  <div className={styles.weekStats}>
                    <span className={styles.weekTotal}>{weekTotal} ml</span>
                    <span className={styles.weekAvg}>~{weekAvg} ml/day</span>
                  </div>
                </div>
                {isWeekOpen ? (
                  days.map(({ date, items }) => {
                    const dayTotal = items.reduce((sum, i) => sum + i.amount, 0);
                    const isDayOpen = openDays.has(date);
                    return (
                      <div key={date} className={styles.dayGroup}>
                        <div className={styles.dayHeader} onClick={() => toggleDay(date)}>
                          <span><span className={`${styles.chevron} ${isDayOpen ? styles.chevronOpen : ''}`}>{'>'}</span>{' '}📅 {formatDateWithWeekday(date, false)}</span>
                          <span className={styles.dayTotal}>{dayTotal} ml</span>
                        </div>
                        {isDayOpen ? (
                          items.map((item) => (
                            <div key={item.id} className={styles.dayItem}>
                              <span className={styles.statusBadge}>{STATUS_EMOJI[item.status]} {item.status}</span>
                              <span className={styles.dayItemAmount}>{item.amount} / {item.originalAmount} ml</span>
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
    <PageLayout title="Milk Saved" emoji="🧊" gradient="blue" ref={visibilityRef}>
      <div className={styles.statsBar}>
        <div className={styles.statChip}>🥛 Fridge: <strong>{totals.fridge} ml</strong></div>
        <div className={styles.statChip}>❄️ Freezer: <strong>{totals.freezer} ml</strong></div>
        <div className={styles.statChip}>🧊 Total: <strong>{totals.total} ml</strong></div>
      </div>
      <div className={styles.statusFilter}>
        {ALL_STATUSES.map((s) => (
          <button key={s} className={`${styles.statusBtn} ${activeStatuses.includes(s) ? styles.statusBtnActive : ''}`} onClick={() => toggleStatus(s)}>
            {STATUS_EMOJI[s]} {s}
          </button>
        ))}
      </div>
      <DateRangeFilter from={from} to={to} view={view} onFromChange={setFrom} onToChange={setTo} onViewChange={setView} />
      <>
        {view === 'item' ? renderItemView() : view === 'day' ? renderDayView() : renderWeekView()}
      </>
    </PageLayout>
  );
};

export default MilkSavedPage;
