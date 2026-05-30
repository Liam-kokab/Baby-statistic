import { useState, useEffect } from 'react';
import { fetch2 } from 'baby-statistic-common/util';
import type { TSleep, TMedicineWithLatestLog, TDrankMilk, TPumping } from 'baby-statistic-common';
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';
import { useActionFeedback } from '../../utils/useActionFeedback';
import type { TActionStatus } from '../../utils/useActionFeedback';
import useRefetchOnVisible from '../../utils/useRefetchOnVisible';
import { ACTION_MIN_MS, ACTION_DONE_MS } from '../../config';
import styles from './HomePage.module.css';

const JSON_HEADERS: HeadersInit = { 'Content-Type': 'application/json' };

const getMilkAgeClass = (createdAt: string): string => {
  const ageMin = (Date.now() - new Date(createdAt).getTime()) / 60_000;
  if (ageMin < 90) return 'milkLastGreen';
  if (ageMin < 120) return 'milkLastYellow';
  return 'milkLastDefault';
};

const formatAgo = (isoString: string): string => {
  const totalMin = Math.floor((Date.now() - new Date(isoString).getTime()) / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m ago` : `${m}m ago`;
};

const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const elapsedSeconds = (isoString: string): number =>
  Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000));

const HomePage = () => {
  // ── Sleep ─────────────────────────────────────────────────────────────────
  const [activeSleep, setActiveSleep]   = useState<TSleep | null>(null);
  const [timerRef,    setTimerRef]      = useState<string | null>(null);
  const [timerDisplay, setTimerDisplay] = useState('00:00:00');
  const sleep = useActionFeedback();

  // ── Drank milk ────────────────────────────────────────────────────────────
  const [drankAmount, setDrankAmount] = useState('');
  const [latestDrank, setLatestDrank] = useState<TDrankMilk | null>(null);
  const [suggestedAmount, setSuggestedAmount] = useState<number | null>(null);
  const bottle = useActionFeedback();
  const boob   = useActionFeedback();

  const loadLatestDrank = async (): Promise<void> => {
    const res = await fetch2<TDrankMilk | null>('/api/drank-milk/latest');
    if (res.ok) {
      setLatestDrank(res.data);
      if (res.data) {
        const ageMin = Math.floor((Date.now() - new Date(res.data.createdAt).getTime()) / 60_000);
        console.log(`[drankMilk] last entry: ${res.data.createdAt} | age: ${ageMin}m (${(ageMin / 60).toFixed(2)}h)`);
      } else {
        console.log('[drankMilk] no entries found');
      }
    }
  };

  const loadSuggested = async (): Promise<void> => {
    const res = await fetch2<{ nextDrinkAmount: number }>('/api/drank-milk/suggested');
    if (res.ok) setSuggestedAmount(res.data.nextDrinkAmount ?? null);
  };

  // ── Waste milk ────────────────────────────────────────────────────────────
  const [wasteAmount, setWasteAmount] = useState('');
  const waste = useActionFeedback();

  // ── Poop / Pee ────────────────────────────────────────────────────────────
  const poop = useActionFeedback();
  const pee  = useActionFeedback();
  const [latestNappy, setLatestNappy] = useState<string | null>(null);

  const loadLatestNappy = async (): Promise<void> => {
    const res = await fetch2<{ createdAt: string } | null>('/api/nappy/latest');
    if (res.ok) setLatestNappy(res.data?.createdAt ?? null);
  };

  // ── Pumping ───────────────────────────────────────────────────────────────
  const [lastPumping, setLastPumping] = useState<TPumping | null>(null);
  const [pumpingTimerRef, setPumpingTimerRef] = useState<string | null>(null);
  const [pumpingDisplay, setPumpingDisplay] = useState('00:00:00');
  const pump = useActionFeedback();

  const loadLatestPumping = async (): Promise<void> => {
    const res = await fetch2<TPumping | null>('/api/pumping/latest');
    if (res.ok) {
      setLastPumping(res.data);
      setPumpingTimerRef(res.data?.createdAt ?? null);
    }
  };

  // ── Medicines ─────────────────────────────────────────────────────────────
  const [medicines, setMedicines]   = useState<TMedicineWithLatestLog[]>([]);
  const [medStatuses, setMedStatuses] = useState<Record<number, TActionStatus>>({});

  const loadMedicines = async (): Promise<void> => {
    const res = await fetch2<TMedicineWithLatestLog[]>('/api/medicine');
    if (res.ok) setMedicines(res.data);
  };

  // Load latest sleep on mount
  const loadSleep = async (): Promise<void> => {
    const res = await fetch2<TSleep | null>('/api/sleep/latest');
    if (!res.ok) return;
    const latest = res.data;
    if (latest?.end === null) {
      setActiveSleep(latest);
      setTimerRef(latest.start);
    } else {
      setActiveSleep(null);
      setTimerRef(latest?.end ?? null);
    }
  };

  const refetchAll = (): void => {
    loadSleep();
    loadLatestDrank();
    loadSuggested();
    loadLatestPumping();
    loadLatestNappy();
    loadMedicines();
  };

  const visibilityRef = useRefetchOnVisible(refetchAll);

  useEffect(() => {
    refetchAll();
    const medRefresh = setInterval(loadMedicines, 60_000);
    return () => { clearInterval(medRefresh); };
  }, []);

  // Timer tick — reruns whenever the reference timestamp changes
  useEffect(() => {
    setTimerDisplay(timerRef ? formatTime(elapsedSeconds(timerRef)) : '00:00:00');
    const id = setInterval(() => {
      setTimerDisplay(timerRef ? formatTime(elapsedSeconds(timerRef)) : '00:00:00');
    }, 1000);
    return () => clearInterval(id);
  }, [timerRef]);

  // Pumping timer tick
  useEffect(() => {
    setPumpingDisplay(pumpingTimerRef ? formatTime(elapsedSeconds(pumpingTimerRef)) : '00:00:00');
    const id = setInterval(() => {
      setPumpingDisplay(pumpingTimerRef ? formatTime(elapsedSeconds(pumpingTimerRef)) : '00:00:00');
    }, 1000);
    return () => clearInterval(id);
  }, [pumpingTimerRef]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSleepToggle = (): void => {
    sleep.run(async () => {
      const now = new Date().toISOString();
      const res = activeSleep
        ? await fetch2<TSleep>(`/api/sleep/${activeSleep.id}`, {
            method: 'PUT',
            headers: JSON_HEADERS,
            body: JSON.stringify({ start: activeSleep.start, end: now }),
          })
        : await fetch2<TSleep>('/api/sleep', {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ start: now }),
          });
      if (res.ok) await loadSleep();
      return res.ok;
    });
  };

  const handleDrankMilk = (source: 'FRIDGE' | 'BOOB', isNewBottle: boolean): void => {
    const amount = Number(drankAmount);
    if (!amount || amount <= 0) return;
    const fb = source === 'FRIDGE' ? bottle : boob;
    fb.run(async () => {
      const res = await fetch2('/api/drank-milk', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ amount, source, isNewBottle }),
      });
      if (res.ok) {
        setDrankAmount('');
        await Promise.all([
          loadLatestDrank(),
          loadSuggested(),
        ]);
      }
      return res.ok;
    });
  };

  const latestDrankAgeMinutes = latestDrank
    ? Math.floor((Date.now() - new Date(latestDrank.createdAt).getTime()) / 60_000)
    : null;
  const prevBottleEnabled = latestDrankAgeMinutes !== null && latestDrankAgeMinutes <= 150;

  const handleWasteMilk = (): void => {
    const amount = Number(wasteAmount);
    if (!amount || amount <= 0) return;
    waste.run(async () => {
      const res = await fetch2('/api/drank-milk/waste', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ amount }),
      });
      if (res.ok) setWasteAmount('');
      return res.ok;
    });
  };

  const handlePoop = (): void => {
    poop.run(async () => {
      const res = await fetch2('/api/poop', { method: 'POST' });
      if (res.ok) await loadLatestNappy();
      return res.ok;
    });
  };

  const handlePee = (): void => {
    pee.run(async () => {
      const res = await fetch2('/api/pee', { method: 'POST' });
      if (res.ok) await loadLatestNappy();
      return res.ok;
    });
  };

  const handlePump = (): void => {
    pump.run(async () => {
      const res = await fetch2<TPumping>('/api/pumping', { method: 'POST' });
      if (res.ok) await loadLatestPumping();
      return res.ok;
    });
  };

  const handleMarkTaken = (id: number): void => {
    if (medStatuses[id] && medStatuses[id] !== 'idle') return;
    const setStatus = (s: TActionStatus) =>
      setMedStatuses((prev) => ({ ...prev, [id]: s }));
    setStatus('loading');
    const t0 = Date.now();
    fetch2(`/api/medicine/${id}/log`, { method: 'POST' }).then(async (res) => {
      const wait = ACTION_MIN_MS - (Date.now() - t0);
      if (wait > 0) await new Promise<void>((r) => setTimeout(r, wait));
      if (res.ok) await loadMedicines();
      setStatus(res.ok ? 'success' : 'error');
      setTimeout(() => setStatus('idle'), ACTION_DONE_MS);
    });
  };

  const isTakenToday = (m: TMedicineWithLatestLog): boolean => {
    if (!m.latestTakenAt) return false;
    const today = new Date().toLocaleDateString('sv'); // YYYY-MM-DD in local time
    return m.latestTakenAt.slice(0, 10) === today;
  };

  const isSleeping = activeSleep !== null;

  return (
    <div className={styles.page} ref={visibilityRef}>
      <div className={styles.hero}>
        <p className={styles.heroEmoji}>{isSleeping ? '😴' : '🌸'}</p>
        <h1 className={styles.heroTitle}>Baby Stats</h1>
        <p className={styles.heroSub}>Track every little moment 💕</p>
      </div>

      <div className={styles.content}>

        {/* ── Sleep ── */}
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>😴 Sleep</h2>
          <div className={styles.sleepRow}>
            <div className={styles.sleepLeft}>
              <span className={`${styles.sleepBadge} ${isSleeping ? styles.sleeping : styles.awake}`}>
                {isSleeping ? 'Sleeping' : 'Awake'}
              </span>
              <span className={styles.timer}>{timerDisplay}</span>
              <span className={styles.timerLabel}>
                {isSleeping ? 'Sleeping for' : 'Awake for'}
              </span>
            </div>
            <Button
              text={isSleeping ? 'End' : 'Start'}
              emoji={isSleeping ? '☀️' : '🌙'}
              onClick={handleSleepToggle}
              status={sleep.status}
              variant={isSleeping ? 'ghost' : 'primary'}
            />
          </div>

          <div className={styles.divider} />

          <div className={styles.sleepRow}>
            <div className={styles.sleepLeft}>
              <span className={styles.timer}>{pumpingDisplay}</span>
              <span className={styles.timerLabel}>
                {lastPumping ? 'Since last pump' : 'No pump logged yet'}
              </span>
            </div>
            <Button
              text="Pumped"
              emoji="🥛"
              onClick={handlePump}
              status={pump.status}
              variant="primary"
            />
          </div>
        </section>

        {/* ── Milk ── */}
        <section className={styles.card}>
          <div className={styles.milkHeader}>
            <h2 className={styles.sectionTitle}>🍼 Milk</h2>
            {latestDrank ? (
              <span className={`${styles.milkLastInfo} ${styles[getMilkAgeClass(latestDrank.createdAt)]}`}>
                {latestDrank.amount} ml · {formatAgo(latestDrank.createdAt)}
              </span>
            ) : (
              <span className={`${styles.milkLastInfo} ${styles.milkLastDefault}`}>
                No last dranked milk
              </span>
            )}
          </div>

          <div className={styles.subSection}>
            <p className={styles.subLabel}>Baby drank</p>
            <Input
              label="Amount (ml)"
              value={drankAmount}
              onChange={setDrankAmount}
              type="tel"
              placeholder={`e.g. ${suggestedAmount ?? 80}`}
              name="drankAmount"
            />
            <div className={styles.btnRowFull}>
                <Button
                  text="Prev bottle"
                  emoji="🍼"
                  onClick={() => handleDrankMilk('FRIDGE', false)}
                  status={bottle.status}
                  disabled={!drankAmount || !prevBottleEnabled}
                />
                <Button
                  text="New bottle"
                  emoji="🍼"
                  onClick={() => handleDrankMilk('FRIDGE', true)}
                  status={bottle.status}
                  disabled={!drankAmount}
                />
              </div>
              <div className={styles.btnRowFull}>
                <Button
                  text="Boob"
                  emoji="🤱"
                  onClick={() => handleDrankMilk('BOOB', true)}
                  status={boob.status}
                  disabled={!drankAmount}
                  variant="secondary"
                />
              </div>
          </div>

          <div className={styles.divider} />

          <div className={styles.subSection}>
            <p className={styles.subLabel}>Waste — subtracts from last log</p>
            <Input
              label="Amount (ml)"
              value={wasteAmount}
              onChange={setWasteAmount}
              type="tel"
              placeholder="e.g. 10"
              name="wasteAmount"
            />
            <Button
              text="Subtract waste"
              emoji="➖"
              onClick={handleWasteMilk}
              status={waste.status}
              disabled={!wasteAmount}
              variant="ghost"
            />
          </div>
        </section>

        {/* ── Nappy ── */}
        <section className={styles.card}>
          <div className={styles.milkHeader}>
            <h2 className={styles.sectionTitle}>🚽 Nappy</h2>
            <span className={`${styles.milkLastInfo} ${styles.milkLastDefault}`}>
              {latestNappy ? `Changed ${formatAgo(latestNappy)}` : 'No diaper change logged'}
            </span>
          </div>
          <div className={styles.btnRowFull}>
            <Button
              text="Poop 💩"
              onClick={handlePoop}
              status={poop.status}
              variant="secondary"
            />
            <Button
              text="Pee 💧"
              onClick={handlePee}
              status={pee.status}
              variant="secondary"
            />
          </div>
        </section>


        {/* ── Medicines ── */}
        {medicines.length > 0 ? (
          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>💊 Medicines</h2>
            <div className={styles.medList}>
              {medicines.map((m) => {
                const takenToday = isTakenToday(m);
                return (
                  <div key={m.id} className={styles.medRow}>
                    <div className={styles.medInfo}>
                      <span className={styles.medName}>{m.name}</span>
                      <span className={`${styles.medLabel} ${takenToday ? styles.medLabelCountdown : styles.medLabelOverdue}`}>
                        {takenToday ? '✓ Taken today' : 'Not taken today'}
                      </span>
                    </div>
                    <Button
                      text="Take"
                      emoji="💊"
                      onClick={() => handleMarkTaken(m.id)}
                      status={medStatuses[m.id] ?? 'idle'}
                      variant={takenToday ? 'ghost' : 'primary'}
                      disabled={takenToday}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

      </div>
    </div>
  );
};

export default HomePage;
