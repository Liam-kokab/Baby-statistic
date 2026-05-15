import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetch2 } from 'baby-statistic-common/util';
import type { TServedMilk, TServedMilkTotal, TServedMilkStatus } from 'baby-statistic-common';
import PageLayout from '../../components/PageLayout/PageLayout';
import DateRangeFilter from '../../components/DateRangeFilter/DateRangeFilter';
import type { TView } from '../../components/DateRangeFilter/DateRangeFilter';
import Button from '../../components/Button/Button';
import { groupByDay } from '../../utils/groupByDay';
import { groupByWeek } from '../../utils/groupByWeek';
import { formatTime, formatDateTime, formatDateWithWeekday } from '../../utils/format';
import styles from './MilkSavedPage.module.css';

const STATUS_EMOJI: Record<TServedMilkStatus, string> = {
  FRIDGE:  '🥛',
  FREEZER: '❄️',
  USED:    '✅',
  EXPIRED: '⚠️',
};

const ALL_STATUSES: TServedMilkStatus[] = ['FRIDGE', 'FREEZER', 'USED', 'EXPIRED'];

const getDefaultFrom = (): string => {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d.toISOString().slice(0, 10);
};

const getDefaultTo = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
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

  const [data, setData] = useState<TServedMilk[]>([]);
  const [totals, setTotals] = useState<TServedMilkTotal>({ fridge: 0, freezer: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStatuses, setActiveStatuses] = useState<TServedMilkStatus[]>(['FRIDGE', 'FREEZER']);
  const [openDays,  setOpenDays]  = useState<Set<string>>(new Set());
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ from: `${from}T00:00:00`, to: `${to}T23:59:59` });
      const [listResult, totalResult] = await Promise.all([
        fetch2<TServedMilk[]>(`/api/served-milk?${params}`),
        fetch2<TServedMilkTotal>('/api/served-milk/total'),
      ]);
      if (listResult.ok) {
        setData(listResult.data);
      } else {
        setError(listResult.error);
      }
      if (totalResult.ok) {
        setTotals(totalResult.data);
      }
      setLoading(false);
    };
    load();
  }, [from, to]);

  const toggleStatus = (status: TServedMilkStatus): void => {
    setActiveStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  const toggleDay = (date: string): void =>
    setOpenDays((prev) => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });

  const toggleWeek = (weekKey: string): void =>
    setOpenWeeks((prev) => {
      const next = new Set(prev);
      next.has(weekKey) ? next.delete(weekKey) : next.add(weekKey);
      return next;
    });

  const filtered = data.filter((d) => activeStatuses.includes(d.status));

  const renderItemView = () => {
    const sorted = [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return (
      <div className={styles.list}>
        {sorted.length === 0 ? (
          <p className={styles.empty}>No records found 🧊</p>
        ) : (
          sorted.map((item) => (
            <div key={item.id} className={styles.card}>
              <span className={styles.statusBadge}>{STATUS_EMOJI[item.status]} {item.status}</span>
              <span className={styles.amount}>{item.amount} / {item.originalAmount} ml</span>
              <span className={styles.date}>
                {formatDateTime(item.createdAt)}
              </span>
              <Button
                emoji="✏️"
                variant="ghost"
                className={styles.editBtn}
                onClick={() => navigate(`/stored-milk/${item.id}`)}
              />
            </div>
          ))
        )}
      </div>
    );
  };

  const renderDayView = () => {
    const groups = groupByDay(filtered);
    return (
      <div className={styles.list}>
        {groups.length === 0 ? (
          <p className={styles.empty}>No records found 🧊</p>
        ) : (
          groups.map(({ date, items }) => {
            const dayTotal = items.reduce((sum, i) => sum + i.amount, 0);
            const isOpen = openDays.has(date);
            return (
              <div key={date} className={styles.dayGroup}>
                <div className={styles.dayHeader} onClick={() => toggleDay(date)}>
                  <span>
                    <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>{'>'}</span>{' '}📅{' '}
                    {formatDateWithWeekday(date)}
                  </span>
                  <span className={styles.dayTotal}>{dayTotal} ml</span>
                </div>
                {isOpen ? (
                  items.map((item) => (
                    <div key={item.id} className={styles.dayItem}>
                      <span className={styles.statusBadge}>{STATUS_EMOJI[item.status]} {item.status}</span>
                      <span className={styles.dayItemAmount}>{item.amount} / {item.originalAmount} ml</span>
                      <span className={styles.time}>
                        {formatTime(item.createdAt)}
                      </span>
                    </div>
                  ))
                ) : null}
              </div>
            );
          })
        )}
      </div>
    );
  };

  const renderWeekView = () => {
    const weeks = groupByWeek(filtered);
    return (
      <div className={styles.list}>
        {weeks.length === 0 ? (
          <p className={styles.empty}>No records found 🧊</p>
        ) : (
          weeks.map(({ weekKey, weekLabel, days }) => {
            const weekTotal  = days.reduce((sum, { items }) => sum + items.reduce((s, i) => s + i.amount, 0), 0);
            const weekAvg    = Math.round(weekTotal / 7);
            const isWeekOpen = openWeeks.has(weekKey);
            return (
              <div key={weekKey} className={styles.weekGroup}>
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
                          <span>
                            <span className={`${styles.chevron} ${isDayOpen ? styles.chevronOpen : ''}`}>{'>'}</span>{' '}📅{' '}
                            {formatDateWithWeekday(date, false)}
                          </span>
                          <span className={styles.dayTotal}>{dayTotal} ml</span>
                        </div>
                        {isDayOpen ? (
                          items.map((item) => (
                            <div key={item.id} className={styles.dayItem}>
                              <span className={styles.statusBadge}>{STATUS_EMOJI[item.status]} {item.status}</span>
                              <span className={styles.dayItemAmount}>{item.amount} / {item.originalAmount} ml</span>
                              <span className={styles.time}>
                                {formatTime(item.createdAt)}
                              </span>
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
      </div>
    );
  };

  return (
    <PageLayout title="Milk Saved" emoji="🧊" gradient="blue">
      <div className={styles.statsBar}>
        <div className={styles.statChip}>🥛 Fridge: <strong>{totals.fridge} ml</strong></div>
        <div className={styles.statChip}>❄️ Freezer: <strong>{totals.freezer} ml</strong></div>
        <div className={styles.statChip}>🧊 Total: <strong>{totals.total} ml</strong></div>
      </div>
      <div className={styles.statusFilter}>
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            className={`${styles.statusBtn} ${activeStatuses.includes(s) ? styles.statusBtnActive : ''}`}
            onClick={() => toggleStatus(s)}
          >
            {STATUS_EMOJI[s]} {s}
          </button>
        ))}
      </div>
      <DateRangeFilter
        from={from}
        to={to}
        view={view}
        onFromChange={setFrom}
        onToChange={setTo}
        onViewChange={setView}
      />
      {loading ? (
        <p className={styles.loadingMsg}>Loading… ⏳</p>
      ) : error ? (
        <p className={styles.errorMsg}>⚠️ {error}</p>
      ) : (
        <>
          {view === 'item' ? renderItemView() : view === 'day' ? renderDayView() : renderWeekView()}
        </>
      )}
    </PageLayout>
  );
};

export default MilkSavedPage;

