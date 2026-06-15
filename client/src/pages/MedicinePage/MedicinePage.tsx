import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetch2 } from 'baby-statistic-common/util';
import type { TMedicine, TMedicineLog, TWishedResult } from 'baby-statistic-common';
import PageLayout from '../../components/PageLayout/PageLayout';
import DateRangeFilter from '../../components/DateRangeFilter/DateRangeFilter';
import type { TView } from '../../components/DateRangeFilter/DateRangeFilter';
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';
import Checkmark from '../../components/Checkmark/Checkmark';
import { groupByDay } from '../../utils/groupByDay';
import { groupByWeek } from '../../utils/groupByWeek';
import { formatDateTime, formatDateWithWeekday } from '../../utils/format';
import useRefetchOnVisible from '../../utils/useRefetchOnVisible';
import useTimeWindowScroll, { getWindowEnd } from '../../utils/useInfiniteScroll';
import { hasEnoughForView } from '../../utils/hasEnoughForView';
import styles from './MedicinePage.module.css';

const JSON_HEADERS: HeadersInit = { 'Content-Type': 'application/json' };

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

type TLogWithName = TMedicineLog & { medicineName: string };

const MedicinePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const from = searchParams.get('from') ?? getDefaultFrom();
  const to   = searchParams.get('to')   ?? getDefaultTo();
  const view = (searchParams.get('view') ?? 'item') as TView;

  const setFrom = (v: string) => setSearchParams((p) => { p.set('from', v); return p; });
  const setTo   = (v: string) => setSearchParams((p) => { p.set('to',   v); return p; });
  const setView = (v: TView)  => setSearchParams((p) => { p.set('view', v); return p; });

  const [allMedicines, setAllMedicines] = useState<TMedicine[]>([]);
  const [error, setError]               = useState<string | null>(null);
  const [openDays,  setOpenDays]  = useState<Set<string>>(new Set());
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(new Set());
  const [openMed,   setOpenMed]   = useState<string | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newName, setNewName]           = useState('');
  const [addLoading, setAddLoading]     = useState(false);
  const [addError, setAddError]         = useState<string | null>(null);

  const loadMedicines = useCallback(async (): Promise<void> => {
    const allRes = await fetch2<TMedicine[]>('/api/medicine/all');
    if (allRes.ok) setAllMedicines(allRes.data);
  }, []);

  useEffect(() => { loadMedicines(); }, [loadMedicines]);

  const fetchWindow = useCallback(async (winFrom: string, winTo: string): Promise<TWishedResult<TMedicineLog>> => {
    setError(null);
    const params = new URLSearchParams({ from: winFrom, to: winTo, wished: '50' });
    const result = await fetch2<TWishedResult<TMedicineLog>>(`/api/medicine/logs?${params}`);
    if (result.ok) return result.data;
    setError(result.error);
    return { items: [], actualFrom: winFrom.slice(0, 10) };
  }, []);

  const hasEnough = useCallback(
    (items: TMedicineLog[]) => hasEnoughForView(items, view, (i) => i.takenAt),
    [view],
  );

  const { data, loading, hasMore, sentinelRef, refresh } = useTimeWindowScroll(from, to, fetchWindow, hasEnough);

  const visibilityRef = useRefetchOnVisible(() => { loadMedicines(); refresh(); });

  // Merge log data with medicine names
  const nameMap = useMemo(
    () => new Map(allMedicines.map((m) => [m.id, m.name])),
    [allMedicines],
  );
  const logs: TLogWithName[] = useMemo(
    () => data.map((l) => ({ ...l, medicineName: nameMap.get(l.medicineId) ?? `#${l.medicineId}` })),
    [data, nameMap],
  );

  const toggleDay = (date: string): void =>
    setOpenDays((prev) => { const n = new Set(prev); n.has(date) ? n.delete(date) : n.add(date); return n; });

  const toggleWeek = (weekKey: string): void =>
    setOpenWeeks((prev) => { const n = new Set(prev); n.has(weekKey) ? n.delete(weekKey) : n.add(weekKey); return n; });

  const toggleMed = (key: string): void =>
    setOpenMed((prev) => (prev === key ? null : key));

  const groupByMedicine = (items: TLogWithName[]): { name: string; items: TLogWithName[] }[] => {
    const map = new Map<string, TLogWithName[]>();
    items.forEach((item) => {
      const existing = map.get(item.medicineName);
      if (existing) existing.push(item);
      else map.set(item.medicineName, [item]);
    });
    return Array.from(map.entries()).map(([name, its]) => ({ name, items: its }));
  };

  const renderMedItems = (items: TLogWithName[], medKey: string, sentinelOnHeader?: boolean) => {
    const isOpen = openMed === medKey;
    const sorted = [...items].sort((a, b) => b.takenAt.localeCompare(a.takenAt));
    return (
      <div key={medKey} className={styles.medGroup}>
        <div
          ref={sentinelOnHeader ? sentinelRef : undefined}
          className={styles.medGroupHeader}
          onClick={() => toggleMed(medKey)}
        >
          <span><span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>{'>'}</span>{' '}💊 {items[0].medicineName}</span>
          <span className={styles.dayTotal}>{items.length} dose{items.length !== 1 ? 's' : ''}</span>
        </div>
        {isOpen ? (
          sorted.map((item) => (
            <div key={item.id} className={styles.dayItem}>
              <span className={styles.time}>{formatDateTime(item.takenAt)}</span>
              <Button emoji="✏️" variant="ghost" className={styles.editBtn} onClick={() => navigate(`/medicine/log/${item.id}`)} />
            </div>
          ))
        ) : null}
      </div>
    );
  };

  const handleAddMedicine = async (): Promise<void> => {
    if (!newName.trim()) return;
    setAddLoading(true);
    setAddError(null);
    const res = await fetch2('/api/medicine', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ name: newName.trim() }) });
    if (res.ok) { setNewName(''); await loadMedicines(); }
    else setAddError(res.error);
    setAddLoading(false);
  };

  const handleToggleActive = async (id: number, isActive: boolean): Promise<void> => {
    const res = await fetch2<TMedicine>(`/api/medicine/${id}/active`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ isActive }) });
    if (res.ok) setAllMedicines((prev) => prev.map((m) => (m.id === id ? { ...m, isActive } : m)));
  };

  const renderItemView = () => {
    const groups = groupByMedicine(logs);
    return (
      <div className={styles.list}>
        {logs.length === 0 && !loading ? (
          <p className={styles.empty}>No records found 💊</p>
        ) : (
          groups.map(({ name, items }, idx) =>
            renderMedItems(items, `item-${name}`, hasMore && idx === Math.max(0, groups.length - 5))
          )
        )}
        {loading ? <p className={styles.loadingMsg}>Loading… ⏳</p> : null}
        {!hasMore && logs.length > 0 && !loading ? <p className={styles.endMsg}>All {logs.length} records loaded</p> : null}
      </div>
    );
  };

  const renderDayView = () => {
    const groups = groupByMedicine(logs);
    return (
      <div className={styles.list}>
        {logs.length === 0 && !loading ? (
          <p className={styles.empty}>No records found 💊</p>
        ) : (
          groups.map(({ name, items }, idx) => {
            const medKey = `day-med-${name}`;
            const isOpen = openMed === medKey;
            const days = groupByDay(items, (l) => l.takenAt);
            const isSentinel = hasMore && idx === Math.max(0, groups.length - 5);
            return (
              <div key={medKey} className={styles.medGroup}>
                <div
                  ref={isSentinel ? sentinelRef : undefined}
                  className={styles.medGroupHeader}
                  onClick={() => toggleMed(medKey)}
                >
                  <span><span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>{'>'}</span>{' '}💊 {name}</span>
                  <span className={styles.dayTotal}>{items.length} dose{items.length !== 1 ? 's' : ''}</span>
                </div>
                {isOpen ? (
                  days.map(({ date, items: dayItems }) => {
                    const isDayOpen = openDays.has(date);
                    return (
                      <div key={date} className={styles.dayGroup}>
                        <div className={styles.dayHeader} onClick={() => toggleDay(date)}>
                          <span><span className={`${styles.chevron} ${isDayOpen ? styles.chevronOpen : ''}`}>{'>'}</span>{' '}📅 {formatDateWithWeekday(date)}</span>
                          <span className={styles.dayTotal}>{dayItems.length} dose{dayItems.length !== 1 ? 's' : ''}</span>
                        </div>
                        {isDayOpen ? (
                          dayItems.map((item) => (
                            <div key={item.id} className={styles.dayItem}>
                              <span className={styles.time}>{formatDateTime(item.takenAt)}</span>
                              <Button emoji="✏️" variant="ghost" className={styles.editBtn} onClick={() => navigate(`/medicine/log/${item.id}`)} />
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
        {!hasMore && logs.length > 0 && !loading ? <p className={styles.endMsg}>All days loaded</p> : null}
      </div>
    );
  };

  const renderWeekView = () => {
    const groups = groupByMedicine(logs);
    return (
      <div className={styles.list}>
        {logs.length === 0 && !loading ? (
          <p className={styles.empty}>No records found 💊</p>
        ) : (
          groups.map(({ name, items }, idx) => {
            const medKey = `week-med-${name}`;
            const isOpen = openMed === medKey;
            const weeks = groupByWeek(items, (l) => l.takenAt);
            const isSentinel = hasMore && idx === Math.max(0, groups.length - 5);
            return (
              <div key={medKey} className={styles.medGroup}>
                <div
                  ref={isSentinel ? sentinelRef : undefined}
                  className={styles.medGroupHeader}
                  onClick={() => toggleMed(medKey)}
                >
                  <span><span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>{'>'}</span>{' '}💊 {name}</span>
                  <span className={styles.dayTotal}>{items.length} dose{items.length !== 1 ? 's' : ''}</span>
                </div>
                {isOpen ? (
                  weeks.map(({ weekKey, weekLabel, days }) => {
                    const weekCount = days.reduce((sum, { items: d }) => sum + d.length, 0);
                    const isWeekOpen = openWeeks.has(weekKey);
                    return (
                      <div key={weekKey} className={styles.weekGroup}>
                        <div className={styles.weekHeader} onClick={() => toggleWeek(weekKey)}>
                          <span><span className={`${styles.chevron} ${isWeekOpen ? styles.chevronOpen : ''}`}>{'>'}</span>{' '}📆 {weekLabel}</span>
                          <span className={styles.weekTotal}>{weekCount} doses</span>
                        </div>
                        {isWeekOpen ? (
                          days.map(({ date, items: dayItems }) => {
                            const isDayOpen = openDays.has(date);
                            return (
                              <div key={date} className={styles.dayGroup}>
                                <div className={styles.dayHeader} onClick={() => toggleDay(date)}>
                                  <span><span className={`${styles.chevron} ${isDayOpen ? styles.chevronOpen : ''}`}>{'>'}</span>{' '}📅 {formatDateWithWeekday(date, false)}</span>
                                  <span className={styles.dayTotal}>{dayItems.length} dose{dayItems.length !== 1 ? 's' : ''}</span>
                                </div>
                                {isDayOpen ? (
                                  dayItems.map((item) => (
                                    <div key={item.id} className={styles.dayItem}>
                                      <span className={styles.time}>{formatDateTime(item.takenAt)}</span>
                                      <Button emoji="✏️" variant="ghost" className={styles.editBtn} onClick={() => navigate(`/medicine/log/${item.id}`)} />
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
                ) : null}
              </div>
            );
          })
        )}
        {loading ? <p className={styles.loadingMsg}>Loading… ⏳</p> : null}
        {!hasMore && logs.length > 0 && !loading ? <p className={styles.endMsg}>All weeks loaded</p> : null}
      </div>
    );
  };

  return (
    <PageLayout title="Medicines" emoji="💊" gradient="green" ref={visibilityRef}>
      <DateRangeFilter from={from} to={to} view={view} onFromChange={setFrom} onToChange={setTo} onViewChange={setView} />

      {error ? <p className={styles.errorMsg}>⚠️ {error}</p> : null}
      <>
        {view === 'item' ? renderItemView() : view === 'day' ? renderDayView() : renderWeekView()}
      </>

      <div className={styles.settingsSection}>
        <button className={styles.settingsToggle} onClick={() => setSettingsOpen((o) => !o)}>
          <span className={`${styles.chevron} ${settingsOpen ? styles.chevronOpen : ''}`}>{'>'}</span>{' '}⚙️ Settings
        </button>
        {settingsOpen ? (
          <div className={styles.settingsBody}>
            <h3 className={styles.settingsTitle}>Medicines</h3>
            {allMedicines.length === 0 ? (
              <p className={styles.empty}>No medicines added yet.</p>
            ) : (
              <div className={styles.medicineList}>
                {allMedicines.map((m) => (
                  <div key={m.id} className={styles.medicineRow}>
                    <Checkmark checked={m.isActive} onChange={(val) => handleToggleActive(m.id, val)} />
                    <span className={`${styles.medicineName} ${m.isActive ? '' : styles.medicineInactive}`}>💊 {m.name}</span>
                    <Button emoji="✏️" variant="ghost" className={styles.removeBtn} onClick={() => navigate(`/medicine/${m.id}`)} />
                  </div>
                ))}
              </div>
            )}
            <h3 className={styles.settingsTitle}>Add medicine</h3>
            {addError ? <p className={styles.errorMsg}>⚠️ {addError}</p> : null}
            <div className={styles.addForm}>
              <Input label="Name" value={newName} onChange={setNewName} placeholder="e.g. Vitamin D" name="medicineName" />
              <Button text="Add medicine" emoji="➕" onClick={handleAddMedicine} loading={addLoading} disabled={!newName.trim()} />
            </div>
          </div>
        ) : null}
      </div>
    </PageLayout>
  );
};

export default MedicinePage;

