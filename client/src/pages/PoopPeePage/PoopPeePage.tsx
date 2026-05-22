import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetch2 } from 'baby-statistic-common/util';
import type { TPee, TPoop } from 'baby-statistic-common';
import PageLayout from '../../components/PageLayout/PageLayout';
import DateRangeFilter from '../../components/DateRangeFilter/DateRangeFilter';
import type { TView } from '../../components/DateRangeFilter/DateRangeFilter';
import Button from '../../components/Button/Button';
import { groupByDay } from '../../utils/groupByDay';
import { groupByWeek } from '../../utils/groupByWeek';
import { formatTime, formatDateTime, formatDateWithWeekday } from '../../utils/format';
import useRefetchOnVisible from '../../utils/useRefetchOnVisible';
import styles from './PoopPeePage.module.css';

type TCombinedEvent = {
  id: number;
  type: 'pee' | 'poop';
  createdAt: string;
};

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

const eventEmoji = (type: 'pee' | 'poop'): string => type === 'poop' ? '💩' : '💧';

const PoopPeePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const from = searchParams.get('from') ?? getDefaultFrom();
  const to   = searchParams.get('to')   ?? getDefaultTo();
  const view = (searchParams.get('view') ?? 'item') as TView;

  const setFrom = (v: string) => setSearchParams((p) => { p.set('from', v); return p; });
  const setTo   = (v: string) => setSearchParams((p) => { p.set('to',   v); return p; });
  const setView = (v: TView)  => setSearchParams((p) => { p.set('view', v); return p; });

  const [data, setData] = useState<TCombinedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openDays,  setOpenDays]  = useState<Set<string>>(new Set());
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams({ from: `${from}T00:00:00`, to: `${to}T23:59:59` });
    const [peeResult, poopResult] = await Promise.all([
      fetch2<TPee[]>(`/api/pee?${params}`),
      fetch2<TPoop[]>(`/api/poop?${params}`),
    ]);
    if (!peeResult.ok) { setError(peeResult.error); return; }
    if (!poopResult.ok) { setError(poopResult.error); return; }
    const combined: TCombinedEvent[] = [
      ...peeResult.data.map((p) => ({ id: p.id, type: 'pee' as const, createdAt: p.createdAt })),
      ...poopResult.data.map((p) => ({ id: p.id, type: 'poop' as const, createdAt: p.createdAt })),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setData(combined);
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

  const poopCount = data.filter((d) => d.type === 'poop').length;
  const peeCount  = data.filter((d) => d.type === 'pee').length;

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

  const renderItemView = () => (
    <div className={styles.list}>
      {data.length === 0 ? (
        <p className={styles.empty}>No records found 💩</p>
      ) : (
        data.map((item) => (
          <div key={`${item.type}-${item.id}`} className={styles.card}>
            <span className={styles.cardEmoji}>{eventEmoji(item.type)}</span>
            <span className={styles.eventType}>{item.type === 'poop' ? 'Poop' : 'Pee'}</span>
            <span className={styles.date}>
              {formatDateTime(item.createdAt)}
            </span>
            <Button
              emoji="✏️"
              variant="ghost"
              className={styles.editBtn}
              onClick={() => navigate(`/${item.type}/${item.id}`)}
            />
          </div>
        ))
      )}
    </div>
  );

  const renderDayView = () => {
    const groups = groupByDay(data);
    return (
      <div className={styles.list}>
        {groups.length === 0 ? (
          <p className={styles.empty}>No records found 💩</p>
        ) : (
          groups.map(({ date, items }) => {
            const dayPoop = items.filter((i) => i.type === 'poop').length;
            const dayPee  = items.filter((i) => i.type === 'pee').length;
            const isOpen = openDays.has(date);
            return (
              <div key={date} className={styles.dayGroup}>
                <div className={styles.dayHeader} onClick={() => toggleDay(date)}>
                  <span>
                    <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>{'>'}</span>{' '}📅{' '}
                    {formatDateWithWeekday(date)}
                  </span>
                  <span className={styles.dayTotal}>💩 {dayPoop} &nbsp;💧 {dayPee}</span>
                </div>
                  {isOpen ? (
                    items.map((item) => (
                      <div key={`${item.type}-${item.id}`} className={styles.dayItem}>
                        <span className={styles.dayItemEmoji}>{eventEmoji(item.type)}</span>
                        <span className={styles.dayItemType}>{item.type === 'poop' ? 'Poop' : 'Pee'}</span>
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
          <p className={styles.empty}>No records found 💩</p>
        ) : (
          weeks.map(({ weekKey, weekLabel, days }) => {
            const weekPoop    = days.reduce((s, { items }) => s + items.filter((i) => i.type === 'poop').length, 0);
            const weekPee     = days.reduce((s, { items }) => s + items.filter((i) => i.type === 'pee').length, 0);
            const avgPoop     = (weekPoop / days.length).toFixed(1);
            const avgPee      = (weekPee  / days.length).toFixed(1);
            const isWeekOpen  = openWeeks.has(weekKey);
            return (
              <div key={weekKey} className={styles.weekGroup}>
                <div className={styles.weekHeader} onClick={() => toggleWeek(weekKey)}>
                  <span><span className={`${styles.chevron} ${isWeekOpen ? styles.chevronOpen : ''}`}>{'>'}</span>{' '}📆 {weekLabel}</span>
                  <div className={styles.weekStats}>
                    <span className={styles.weekTotal}>💩 {weekPoop} &nbsp;💧 {weekPee}</span>
                    <span className={styles.weekAvg}>~{avgPoop}/day &nbsp;~{avgPee}/day</span>
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
                          <span>
                            <span className={`${styles.chevron} ${isDayOpen ? styles.chevronOpen : ''}`}>{'>'}</span>{' '}📅{' '}
                            {formatDateWithWeekday(date, false)}
                          </span>
                          <span className={styles.dayTotal}>💩 {dayPoop} &nbsp;💧 {dayPee}</span>
                        </div>
                        {isDayOpen ? (
                          items.map((item) => (
                            <div key={`${item.type}-${item.id}`} className={styles.dayItem}>
                              <span className={styles.dayItemEmoji}>{eventEmoji(item.type)}</span>
                              <span className={styles.dayItemType}>{item.type === 'poop' ? 'Poop' : 'Pee'}</span>
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
    <PageLayout title="Poop & Pee" emoji="💩" gradient="amber" ref={visibilityRef}>
      <DateRangeFilter
        from={from}
        to={to}
        view={view}
        onFromChange={setFrom}
        onToChange={setTo}
        onViewChange={setView}
      />
      <div className={styles.statsBar}>
        <div className={styles.statChip}>💩 Poop: <strong>{poopCount}</strong></div>
        <div className={styles.statChip}>💧 Pee: <strong>{peeCount}</strong></div>
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

export default PoopPeePage;

