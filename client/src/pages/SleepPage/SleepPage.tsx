import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetch2 } from 'baby-statistic-common/util';
import type { TSleep, TPumping } from 'baby-statistic-common';
import PageLayout from '../../components/PageLayout/PageLayout';
import DateRangeFilter from '../../components/DateRangeFilter/DateRangeFilter';
import type { TView } from '../../components/DateRangeFilter/DateRangeFilter';
import Button from '../../components/Button/Button';
import { formatTime, formatDateTime, formatDateWithWeekday } from '../../utils/format';
import { groupByDay } from '../../utils/groupByDay';
import { groupByWeek } from '../../utils/groupByWeek';
import styles from './SleepPage.module.css';

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

const formatMs = (ms: number): string => {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

const formatDuration = (start: string, end: string | null): string => {
  if (!end) return 'Ongoing ⏱️';
  return formatMs(new Date(end).getTime() - new Date(start).getTime());
};

const totalDurationMs = (items: TSleep[]): number =>
  items.reduce((sum, s) => {
    if (!s.end) return sum;
    return sum + (new Date(s.end).getTime() - new Date(s.start).getTime());
  }, 0);

// items must be sorted descending by start (as produced by groupSleepByDay)
const totalAwakeMsForItems = (items: TSleep[]): number =>
  items.reduce((sum, item, i) => {
    if (i === 0) return sum;
    if (!item.end) return sum;
    const gap = Math.max(0, new Date(items[i - 1].start).getTime() - new Date(item.end).getTime());
    return sum + gap;
  }, 0);

const calcAwakeStats = (items: TSleep[]): { totalMs: number; avgMs: number } => {
  const sorted = [...items].sort((a, b) => a.start.localeCompare(b.start));
  const gaps = sorted.reduce<number[]>((acc, item, i) => {
    if (i === 0) return acc;
    const prev = sorted[i - 1];
    if (!prev.end) return acc;
    const gap = new Date(item.start).getTime() - new Date(prev.end).getTime();
    return gap > 0 ? [...acc, gap] : acc;
  }, []);
  const totalMs = gaps.reduce((s, g) => s + g, 0);
  const avgMs = gaps.length > 0 ? Math.round(totalMs / gaps.length) : 0;
  return { totalMs, avgMs };
};

const sleepKeyFn = (item: TSleep): string => item.start;

const SleepPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const from = searchParams.get('from') ?? getDefaultFrom();
  const to   = searchParams.get('to')   ?? getDefaultTo();
  const view = (searchParams.get('view') ?? 'item') as TView;

  const setFrom = (v: string) => setSearchParams((p) => { p.set('from', v); return p; });
  const setTo   = (v: string) => setSearchParams((p) => { p.set('to',   v); return p; });
  const setView = (v: TView)  => setSearchParams((p) => { p.set('view', v); return p; });

  const [data, setData] = useState<TSleep[]>([]);
  const [pumpingData, setPumpingData] = useState<TPumping[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openDays,  setOpenDays]  = useState<Set<string>>(new Set());
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ from: `${from}T00:00:00`, to: `${to}T23:59:59` });
      const [sleepResult, pumpingResult] = await Promise.all([
        fetch2<TSleep[]>(`/api/sleep?${params}`),
        fetch2<TPumping[]>(`/api/pumping?${params}`),
      ]);
      if (sleepResult.ok) {
        setData(sleepResult.data);
      } else {
        setError(sleepResult.error);
      }
      if (pumpingResult.ok) setPumpingData(pumpingResult.data);
      setLoading(false);
    };
    load();
  }, [from, to]);

  const totalMs = totalDurationMs(data);
  const daysWithData = new Set(data.map((d) => d.start.slice(0, 10))).size;
  const avgMs = daysWithData > 0 ? Math.round(totalMs / daysWithData) : 0;

  const { totalMs: awakeTotalMs, avgMs: awakeAvgMs } = calcAwakeStats(data);

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

  const renderSleepItems = (items: TSleep[]) =>
    items.flatMap((item, i) => {
      const next = items[i + 1];
      const awakeMs =
        next?.end
          ? Math.max(0, new Date(item.start).getTime() - new Date(next.end).getTime())
          : null;
      return [
        <div key={item.id} className={styles.dayItem}>
          <span className={styles.dayItemDuration}>😴 {formatDuration(item.start, item.end)}</span>
          <span className={styles.time}>
            {formatTime(item.start)}
            {item.end
              ? ` → ${formatTime(item.end)}`
              : ' → Ongoing'}
          </span>
        </div>,
        ...(awakeMs !== null && awakeMs > 0
          ? [
              <div key={`awake-${item.id}`} className={`${styles.dayItem} ${styles.awakeDayItem}`}>
                <span className={styles.dayItemDuration}>☀️ {formatMs(awakeMs)}</span>
                  <span className={styles.time}>
                    {formatTime(next.end!)}
                    {` → ${formatTime(item.start)}`}
                  </span>
              </div>,
            ]
          : []),
      ];
    });

  const renderItemView = () => {
    const sorted = [...data].sort((a, b) => b.start.localeCompare(a.start));
    return (
      <div className={styles.list}>
        {sorted.length === 0 ? (
          <p className={styles.empty}>No records found 😴</p>
        ) : (
          sorted.flatMap((item, i) => {
            const next = sorted[i + 1];
            const awakeMs =
              next?.end
                ? Math.max(0, new Date(item.start).getTime() - new Date(next.end).getTime())
                : null;
            return [
              <div key={item.id} className={styles.card}>
                <span className={styles.cardEmoji}>😴</span>
                <div className={styles.cardBody}>
                  <span className={styles.duration}>{formatDuration(item.start, item.end)}</span>
                  <span className={styles.timeRange}>
                    {formatDateTime(item.start)}
                    {item.end ? ` → ${formatTime(item.end)}` : ''}
                  </span>
                </div>
                <Button
                  emoji="✏️"
                  variant="ghost"
                  className={styles.editBtn}
                  onClick={() => navigate(`/sleep/${item.id}`)}
                />
              </div>,
              ...(awakeMs !== null && awakeMs > 0
                ? [
                    <div key={`awake-${item.id}`} className={`${styles.card} ${styles.awakeCard}`}>
                      <span className={styles.cardEmoji}>☀️</span>
                      <div className={styles.cardBody}>
                        <span className={styles.duration}>{formatMs(awakeMs)}</span>
                        <span className={styles.timeRange}>
                          {formatDateTime(next.end!)}
                          {` → ${formatTime(item.start)}`}
                        </span>
                      </div>
                    </div>,
                  ]
                : []),
            ];
          })
        )}
      </div>
    );
  };

  const renderDayView = () => {
    const groups = groupByDay(data, sleepKeyFn);
    return (
      <div className={styles.list}>
        {groups.length === 0 ? (
          <p className={styles.empty}>No records found 😴</p>
        ) : (
          groups.map(({ date, items }) => {
            const dayMs    = totalDurationMs(items);
            const dayAwake = totalAwakeMsForItems(items);
            const isOpen = openDays.has(date);
            return (
              <div key={date} className={styles.dayGroup}>
                <div className={styles.dayHeader} onClick={() => toggleDay(date)}>
                  <span>
                    <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>{'>'}</span>{' '}📅{' '}
                    {formatDateWithWeekday(date)}
                  </span>
                  <div className={styles.dayTotals}>
                    <span className={styles.dayTotal}>😴 {formatMs(dayMs)} ({items.length})</span>
                    {dayAwake > 0 ? <span className={styles.dayAwake}>☀️ {formatMs(dayAwake)}</span> : null}
                  </div>
                </div>
                {isOpen ? renderSleepItems(items) : null}
              </div>
            );
          })
        )}
      </div>
    );
  };

  const renderWeekView = () => {
    const weeks = groupByWeek(data, sleepKeyFn);
    return (
      <div className={styles.list}>
        {weeks.length === 0 ? (
          <p className={styles.empty}>No records found 😴</p>
        ) : (
          weeks.map(({ weekKey, weekLabel, days }) => {
            const weekMs      = days.reduce((sum, { items }) => sum + totalDurationMs(items), 0);
            const weekAvgMs   = days.length > 0 ? Math.round(weekMs / days.length) : 0;
            const allItems    = days.flatMap(({ items }) => items);
            const { totalMs: weekAwakeMs } = calcAwakeStats(allItems);
            const weekAwakeAvgMs = days.length > 0 ? Math.round(weekAwakeMs / days.length) : 0;
            const isWeekOpen = openWeeks.has(weekKey);
            return (
              <div key={weekKey} className={styles.weekGroup}>
                <div className={styles.weekHeader} onClick={() => toggleWeek(weekKey)}>
                  <span><span className={`${styles.chevron} ${isWeekOpen ? styles.chevronOpen : ''}`}>{'>'}</span>{' '}📆 {weekLabel}</span>
                  <div className={styles.weekStats}>
                    <div className={styles.weekStatsRow}>
                      <span className={styles.weekTotal}>😴 {formatMs(weekMs)}</span>
                      <span className={styles.weekAvg}>~{formatMs(weekAvgMs)}/day</span>
                    </div>
                    {weekAwakeMs > 0 ? (
                      <div className={styles.weekStatsRow}>
                        <span className={styles.weekAwake}>☀️ {formatMs(weekAwakeMs)}</span>
                        <span className={styles.weekAvg}>~{formatMs(weekAwakeAvgMs)}/day</span>
                      </div>
                    ) : null}
                  </div>
                </div>
                {isWeekOpen ? (
                  days.map(({ date, items }) => {
                    const dayMs    = totalDurationMs(items);
                    const dayAwake = totalAwakeMsForItems(items);
                    const isDayOpen = openDays.has(date);
                    return (
                      <div key={date} className={styles.dayGroup}>
                        <div className={styles.dayHeader} onClick={() => toggleDay(date)}>
                          <span>
                            <span className={`${styles.chevron} ${isDayOpen ? styles.chevronOpen : ''}`}>{'>'}</span>{' '}📅{' '}
                    {formatDateWithWeekday(date)}
                          </span>
                          <div className={styles.dayTotals}>
                            <span className={styles.dayTotal}>😴 {formatMs(dayMs)}</span>
                            {dayAwake > 0 ? <span className={styles.dayAwake}>☀️ {formatMs(dayAwake)}</span> : null}
                          </div>
                        </div>
                        {isDayOpen ? renderSleepItems(items) : null}
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

  const renderPumpingSection = () => {
    const sorted = [...pumpingData].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return (
      <div className={styles.pumpingSection}>
        <h2 className={styles.pumpingSectionTitle}>🥛 Pumping</h2>
        {sorted.length === 0 ? (
          <p className={styles.empty}>No pumping records found 🥛</p>
        ) : (
          <div className={styles.list}>
            {sorted.map((item, i) => {
              const next = sorted[i + 1];
              const gapMs = next
                ? new Date(item.createdAt).getTime() - new Date(next.createdAt).getTime()
                : null;
              return (
                <div key={item.id} className={`${styles.card} ${styles.pumpingCard}`}>
                  <span className={styles.cardEmoji}>🥛</span>
                  <div className={styles.cardBody}>
                    <span className={styles.duration}>
                      {gapMs !== null ? formatMs(gapMs) + ' since prev' : 'First pump'}
                    </span>
                    <span className={styles.timeRange}>{formatDateTime(item.createdAt)}</span>
                  </div>
                  <Button
                    emoji="✏️"
                    variant="ghost"
                    className={styles.editBtn}
                    onClick={() => navigate(`/pumping/${item.id}`)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <PageLayout title="Sleep" emoji="😴" gradient="indigo">
      <DateRangeFilter
        from={from}
        to={to}
        view={view}
        onFromChange={setFrom}
        onToChange={setTo}
        onViewChange={setView}
      />
      <div className={styles.statsBar}>
        <div className={styles.statChip}>😴 Total: <strong>{formatMs(totalMs)}</strong></div>
        <div className={styles.statChip}>📊 Avg/day: <strong>~{formatMs(avgMs)}</strong></div>
        <div className={styles.statChip}>⏳ Awake Total: <strong>{formatMs(awakeTotalMs)}</strong></div>
        <div className={styles.statChip}>📈 Avg Awake: <strong>~{formatMs(awakeAvgMs)}</strong></div>
      </div>
      {loading ? (
        <p className={styles.loadingMsg}>Loading… ⏳</p>
      ) : error ? (
        <p className={styles.errorMsg}>⚠️ {error}</p>
      ) : (
        <>
          {view === 'item' ? renderItemView() : view === 'day' ? renderDayView() : renderWeekView()}
          {renderPumpingSection()}
        </>
      )}
    </PageLayout>
  );
};

export default SleepPage;

