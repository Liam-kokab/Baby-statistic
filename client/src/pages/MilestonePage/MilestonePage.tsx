import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../../utils/authFetch';
import type { TMilestone } from 'baby-statistic-common';
import PageLayout from '../../components/PageLayout/PageLayout';
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';
import Textarea from '../../components/Textarea/Textarea';
import DateTimeInput from '../../components/DateTimeInput/DateTimeInput';
import { formatDate } from '../../utils/format';
import useRefetchOnVisible from '../../utils/useRefetchOnVisible';
import { useTranslation, type TLanguage } from '../../i18n/i18n';
import styles from './MilestonePage.module.css';

type TMilestoneMonthGroup = {
  monthKey: string;
  monthLabel: string;
  items: TMilestone[];
};

const languageToLocale: Record<TLanguage, string> = {
  en: 'en-GB',
  nb: 'nb-NO',
  nn: 'nn-NO',
};

const nowInputValue = (): string => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

const getMilestoneDateOnly = (value: string): string => value.slice(0, 10);

const parseMilestoneDate = (value: string): number => {
  const parsed = Date.parse(`${getMilestoneDateOnly(value)}T00:00:00`);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatMilestoneMonth = (monthKey: string, language: TLanguage): string => {
  const [year, month] = monthKey.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat(languageToLocale[language], {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
};

const MilestonePage = () => {
  const navigate = useNavigate();
  const { t, language } = useTranslation();

  const [milestones, setMilestones] = useState<TMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newOccurredAt, setNewOccurredAt] = useState(nowInputValue());
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const loadMilestones = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    const res = await authFetch<TMilestone[]>('/api/milestones');
    if (res.ok) setMilestones(res.data);
    else setError(res.error);
    setLoading(false);
  }, []);

  useEffect(() => { loadMilestones(); }, [loadMilestones]);

  const visibilityRef = useRefetchOnVisible(() => { loadMilestones(); });

  const groupedMilestones = useMemo<TMilestoneMonthGroup[]>(() => {
    const sortedMilestones = [...milestones].sort((a, b) => parseMilestoneDate(b.occurredAt) - parseMilestoneDate(a.occurredAt));
    return sortedMilestones.reduce<TMilestoneMonthGroup[]>((groups, item) => {
      const dateOnly = getMilestoneDateOnly(item.occurredAt);
      const monthKey = dateOnly.slice(0, 7);
      const lastGroup = groups[groups.length - 1];
      if (lastGroup?.monthKey === monthKey) {
        return [...groups.slice(0, -1), { ...lastGroup, items: [...lastGroup.items, item] }];
      }
      return [...groups, { monthKey, monthLabel: formatMilestoneMonth(monthKey, language), items: [item] }];
    }, []);
  }, [language, milestones]);

  const toggleExpanded = (id: number): void =>
    setExpanded((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const openAddForm = (): void => {
    setNewTitle('');
    setNewDescription('');
    setNewOccurredAt(nowInputValue());
    setAddError(null);
    setAddOpen(true);
  };

  const handleAdd = async (): Promise<void> => {
    if (!newTitle.trim()) return;
    setAddLoading(true);
    setAddError(null);
    const res = await authFetch<TMilestone>('/api/milestones', {
      method: 'POST',
      body: JSON.stringify({
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        occurredAt: newOccurredAt,
      }),
    });
    if (res.ok) {
      setAddOpen(false);
      await loadMilestones();
    } else {
      setAddError(res.error);
    }
    setAddLoading(false);
  };

  return (
    <PageLayout title={t('MILESTONE_PAGE_TITLE')} emoji="🏆" gradient="amber" bannerSlug="my-first" ref={visibilityRef}>
      {addOpen ? (
        <div className={styles.addForm}>
          <Input label={t('MILESTONE_PAGE_TITLE_LABEL')} value={newTitle} onChange={setNewTitle} placeholder={t('MILESTONE_PAGE_TITLE_PLACEHOLDER')} name="milestoneTitle" />
          <Textarea label={t('MILESTONE_PAGE_DESCRIPTION_LABEL')} value={newDescription} onChange={setNewDescription} placeholder={t('MILESTONE_PAGE_DESCRIPTION_PLACEHOLDER')} name="milestoneDescription" />
          <DateTimeInput label={t('MILESTONE_PAGE_DATE_LABEL')} value={newOccurredAt} onChange={setNewOccurredAt} name="milestoneOccurredAt" inputType="date" />
          {addError ? <p className={styles.errorMsg}>⚠️ {addError}</p> : null}
          <div className={styles.addFormActions}>
            <Button text={t('COMMON_SAVE')} emoji="💾" onClick={handleAdd} loading={addLoading} disabled={!newTitle.trim()} />
            <Button text={t('COMMON_CANCEL')} emoji="↩️" variant="secondary" onClick={() => setAddOpen(false)} />
          </div>
        </div>
      ) : (
        <Button className={styles.newBtn} text={t('MILESTONE_PAGE_ADD_MILESTONE')} emoji="➕" onClick={openAddForm} />
      )}

      {error ? <p className={styles.errorMsg}>⚠️ {error}</p> : null}

      {loading ? (
        <p className={styles.loadingMsg}>{t('COMMON_LOADING')}</p>
      ) : milestones.length === 0 ? (
        <p className={styles.empty}>{t('MILESTONE_PAGE_NONE_LOGGED')}</p>
      ) : (
        <div className={styles.list}>
          {groupedMilestones.map((group) => (
            <div key={group.monthKey} className={styles.monthSection}>
              <p className={styles.monthHeading}>{group.monthLabel}</p>
              {group.items.map((m) => {
                const isOpen = expanded.has(m.id);
                return (
                  <div key={m.id} className={styles.card}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardHeaderText} onClick={() => toggleExpanded(m.id)}>
                        <span className={styles.cardTitle}>🏆 {m.title}</span>
                        <span className={styles.cardDate}>{formatDate(m.occurredAt)}</span>
                      </div>
                      <Button emoji="✏️" variant="ghost" className={styles.editBtn} onClick={() => navigate(`/milestones/${m.id}`)} />
                    </div>
                    {m.description ? (
                      <p
                        className={`${styles.description} ${isOpen ? styles.descriptionOpen : styles.descriptionClamped}`}
                        onClick={() => toggleExpanded(m.id)}
                      >
                        {m.description}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </PageLayout>
  );
};

export default MilestonePage;




