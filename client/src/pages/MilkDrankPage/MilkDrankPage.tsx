import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetch2 } from 'baby-statistic-common/util';
import type { TDrankMilk, TDrankMilkSource } from 'baby-statistic-common';
import PageLayout from '../../components/PageLayout/PageLayout';
import DateRangeFilter from '../../components/DateRangeFilter/DateRangeFilter';
import type { TView } from '../../components/DateRangeFilter/DateRangeFilter';
import Button from '../../components/Button/Button';
import { groupByDay } from '../../utils/groupByDay';
import { groupByWeek } from '../../utils/groupByWeek';
import { formatTime, formatDateTime, formatDateWithWeekday } from '../../utils/format';
import useRefetchOnVisible from '../../utils/useRefetchOnVisible';
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

const getDefaultTo = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

const MilkDrankPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const from = searchParams.get('from') ?? getDefaultFrom();
  const to   = searchParams.get('to')   ?? getDefaultTo();
  const view = (searchParams.get('view') ?? 'item') as TView;

  const setFrom = (v: string) => setSearchParams((p) => { p.set('from', v); return p; });
  const setTo   = (v: string) => setSearchParams((p) => { p.set('to',   v); return p; });
  const setView = (v: TView)  => setSearchParams((p) => { p.set('view', v); return p; });

  const [data, setData] = useState<TDrankMilk[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openDays,  setOpenDays]  = useState<Set<string>>(new Set());
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams({ from: `${from}T00:00:00`, to: `${to}T23:59:59` });
    const result = await fetch2<TDrankMilk[]>(`/api/drank-milk?${params}`);
    if (result.ok) {
      setData(result.data);
    } else {
      setError(result.error);
    }
  }, [from, to]);

  const visibilityRef = useRefetchOnVisible(load);

  useEffect(() => {
    const initialLoad = async () => {
      setLoading(true);
      await load();
      setLoading(false);
    };
    initialLoad();
  }, [load]);

  const periodTotal    = data.reduce((sum, d) => sum + d.amount, 0);
  const daysWithData   = new Set(data.map((d) => d.createdAt.slice(0, 10))).size;
  const periodAvg      = daysWithData > 0 ? Math.round(periodTotal / daysWithData) : 0;
  const periodHasBoob  = hasBoob(data);

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

  const renderItemView = () => {
    const sorted = [...data].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return (
      <div className={styles.list}>
        {sorted.length === 0 ? (
          <p className={styles.empty}>No records found 🍼</p>
        ) : (
          sorted.map((item, idx) => {
            const ageClass = idx === 0 ? getTopCardAgeClass(item.createdAt) : '';
            return (
            <div key={item.id} className={`${styles.card}${ageClass ? ` ${styles[ageClass]}` : ''}`}>
              <span className={styles.sourceEmoji}>{sourceEmoji(item.source)}</span>
              <span className={styles.amount}>{item.amount} ml</span>
              <span className={styles.date}>
                {formatDateTime(item.createdAt)}
              </span>
              <Button
                emoji="✏️"
                variant="ghost"
                className={styles.editBtn}
                onClick={() => navigate(`/drank-milk/${item.id}`)}
              />
            </div>
            );
          })
        )}
      </div>
    );
  };

  const renderDayView = () => {
    const groups = groupByDay(data);
    return (
      <div className={styles.list}>
        {groups.length === 0 ? (
          <p className={styles.empty}>No records found 🍼</p>
        ) : (
          groups.map(({ date, items }) => {
            const dayTotal = items.reduce((sum, i) => sum + i.amount, 0);
            const dayHasBoob = hasBoob(items);
            const isOpen = openDays.has(date);
            return (
              <div key={date} className={styles.dayGroup}>
                <div className={styles.dayHeader} onClick={() => toggleDay(date)}>
                  <span>
                    <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>{'>'}</span>{' '}📅{' '}
                    {formatDateWithWeekday(date)}
                  </span>
                  <span className={styles.dayTotal}>{dayTotal}{dayHasBoob ? '*' : ''} ml</span>
                </div>
                {isOpen ? (
                  items.map((item) => (
                    <div key={item.id} className={styles.dayItem}>
                      <span className={styles.dayItemSource}>{sourceEmoji(item.source)}</span>
                      <span className={styles.dayItemAmount}>{item.amount} ml</span>
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
    const weeks = groupByWeek(data);
    return (
      <div className={styles.list}>
        {weeks.length === 0 ? (
          <p className={styles.empty}>No records found 🍼</p>
        ) : (
          weeks.map(({ weekKey, weekLabel, days }) => {
            const weekTotal  = days.reduce((sum, { items }) => sum + items.reduce((s, i) => s + i.amount, 0), 0);
            const weekAvg    = Math.round(weekTotal / 7);
            const weekHasBoob = days.some(({ items }) => hasBoob(items));
            const isWeekOpen = openWeeks.has(weekKey);
            return (
              <div key={weekKey} className={styles.weekGroup}>
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
                          <span>
                            <span className={`${styles.chevron} ${isDayOpen ? styles.chevronOpen : ''}`}>{'>'}</span>{' '}📅{' '}
                            {formatDateWithWeekday(date, false)}
                          </span>
                          <span className={styles.dayTotal}>{dayTotal}{dayHasBoob ? '*' : ''} ml</span>
                        </div>
                        {isDayOpen ? (
                          items.map((item) => (
                            <div key={item.id} className={styles.dayItem}>
                              <span className={styles.dayItemSource}>{sourceEmoji(item.source)}</span>
                              <span className={styles.dayItemAmount}>{item.amount} ml</span>
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
    <div ref={visibilityRef}>
    <PageLayout title="Milk Drank" emoji="🍼" gradient="green">
      <DateRangeFilter
        from={from}
        to={to}
        view={view}
        onFromChange={setFrom}
        onToChange={setTo}
        onViewChange={setView}
      />
      <div className={styles.statsBar}>
        <div className={styles.statChip}>🍼 Total: <strong>{periodTotal}{periodHasBoob ? '*' : ''} ml</strong></div>
        <div className={styles.statChip}>📊 Avg/day: <strong>~{periodAvg}{periodHasBoob ? '*' : ''} ml</strong></div>
      </div>
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
    </div>
  );
};

export default MilkDrankPage;

