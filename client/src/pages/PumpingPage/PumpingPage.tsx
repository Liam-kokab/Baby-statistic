import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetch2 } from 'baby-statistic-common/util';
import type { TPumping } from 'baby-statistic-common';
import PageLayout from '../../components/PageLayout/PageLayout';
import DateRangeFilter from '../../components/DateRangeFilter/DateRangeFilter';
import type { TView } from '../../components/DateRangeFilter/DateRangeFilter';
import Button from '../../components/Button/Button';
import { groupByDay } from '../../utils/groupByDay';
import { groupByWeek } from '../../utils/groupByWeek';
import { formatTime, formatDateTime, formatDateWithWeekday } from '../../utils/format';
import styles from './PumpingPage.module.css';

const getDefaultFrom = (): string => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
};

const getDefaultTo = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

const PumpingPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const from = searchParams.get('from') ?? getDefaultFrom();
  const to   = searchParams.get('to')   ?? getDefaultTo();
  const view = (searchParams.get('view') ?? 'item') as TView;

  const setFrom = (v: string) => setSearchParams((p) => { p.set('from', v); return p; });
  const setTo   = (v: string) => setSearchParams((p) => { p.set('to',   v); return p; });
  const setView = (v: TView)  => setSearchParams((p) => { p.set('view', v); return p; });

  const [data, setData] = useState<TPumping[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openDays,  setOpenDays]  = useState<Set<string>>(new Set());
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ from: `${from}T00:00:00`, to: `${to}T23:59:59` });
      const result = await fetch2<TPumping[]>(`/api/pumping?${params}`);
      if (result.ok) {
        setData(result.data);
      } else {
        setError(result.error);
      }
      setLoading(false);
    };
    load();
  }, [from, to]);

  const totalCount = data.length;
  const daysWithData = new Set(data.map((d) => d.createdAt.slice(0, 10))).size;
  const avgPerDay = daysWithData > 0 ? (totalCount / daysWithData).toFixed(1) : '0';

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
          <p className={styles.empty}>No pumping records found 🥛</p>
        ) : (
          sorted.map((item) => (
            <div key={item.id} className={styles.card}>
              <span className={styles.cardEmoji}>🥛</span>
              <span className={styles.date}>{formatDateTime(item.createdAt)}</span>
              <Button
                emoji="✏️"
                variant="ghost"
                className={styles.editBtn}
                onClick={() => navigate(`/pumping/${item.id}`)}
              />
            </div>
          ))
        )}
      </div>
    );
  };

  const renderDayView = () => {
    const groups = groupByDay(data);
    return (
      <div className={styles.list}>
        {groups.length === 0 ? (
          <p className={styles.empty}>No pumping records found 🥛</p>
        ) : (
          groups.map(({ date, items }) => {
            const isOpen = openDays.has(date);
            return (
              <div key={date} className={styles.dayGroup}>
                <div className={styles.dayHeader} onClick={() => toggleDay(date)}>
                  <span>
                    <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>{'>'}</span>{' '}📅{' '}
                    {formatDateWithWeekday(date)}
                  </span>
                  <span className={styles.dayTotal}>🥛 {items.length}</span>
                </div>
                {isOpen ? (
                  items.map((item) => (
                    <div key={item.id} className={styles.dayItem}>
                      <span className={styles.dayItemEmoji}>🥛</span>
                      <span className={styles.time}>{formatTime(item.createdAt)}</span>
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
          <p className={styles.empty}>No pumping records found 🥛</p>
        ) : (
          weeks.map(({ weekKey, weekLabel, days }) => {
            const weekCount  = days.reduce((s, { items }) => s + items.length, 0);
            const weekAvg    = (weekCount / days.length).toFixed(1);
            const isWeekOpen = openWeeks.has(weekKey);
            return (
              <div key={weekKey} className={styles.weekGroup}>
                <div className={styles.weekHeader} onClick={() => toggleWeek(weekKey)}>
                  <span><span className={`${styles.chevron} ${isWeekOpen ? styles.chevronOpen : ''}`}>{'>'}</span>{' '}📆 {weekLabel}</span>
                  <div className={styles.weekStats}>
                    <span className={styles.weekTotal}>🥛 {weekCount}</span>
                    <span className={styles.weekAvg}>~{weekAvg}/day</span>
                  </div>
                </div>
                {isWeekOpen ? (
                  days.map(({ date, items }) => {
                    const isDayOpen = openDays.has(date);
                    return (
                      <div key={date} className={styles.dayGroup}>
                        <div className={styles.dayHeader} onClick={() => toggleDay(date)}>
                          <span>
                            <span className={`${styles.chevron} ${isDayOpen ? styles.chevronOpen : ''}`}>{'>'}</span>{' '}📅{' '}
                            {formatDateWithWeekday(date, false)}
                          </span>
                          <span className={styles.dayTotal}>🥛 {items.length}</span>
                        </div>
                        {isDayOpen ? (
                          items.map((item) => (
                            <div key={item.id} className={styles.dayItem}>
                              <span className={styles.dayItemEmoji}>🥛</span>
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
      </div>
    );
  };

  return (
    <PageLayout title="Pumping" emoji="🥛" gradient="indigo">
      <DateRangeFilter
        from={from}
        to={to}
        view={view}
        onFromChange={setFrom}
        onToChange={setTo}
        onViewChange={setView}
      />
      <div className={styles.statsBar}>
        <div className={styles.statChip}>🥛 Total: <strong>{totalCount}</strong></div>
        <div className={styles.statChip}>📊 Avg/day: <strong>~{avgPerDay}</strong></div>
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
  );
};

export default PumpingPage;

