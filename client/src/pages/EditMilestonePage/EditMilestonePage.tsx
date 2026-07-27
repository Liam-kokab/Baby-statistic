import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authFetch } from '../../utils/authFetch';
import type { TMilestone } from 'baby-statistic-common';
import PageLayout from '../../components/PageLayout/PageLayout';
import Input from '../../components/Input/Input';
import Textarea from '../../components/Textarea/Textarea';
import DateTimeInput from '../../components/DateTimeInput/DateTimeInput';
import Button from '../../components/Button/Button';
import { useTranslation } from '../../i18n/i18n';
import styles from './EditMilestonePage.module.css';

const toInputValue = (isoStr: string): string => isoStr.slice(0, 16);

const EditMilestonePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goBack = (): void => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/milestones');
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await authFetch<TMilestone>(`/api/milestones/${id}`);
      if (res.ok) {
        setTitle(res.data.title);
        setDescription(res.data.description ?? '');
        setOccurredAt(toInputValue(res.data.occurredAt));
      } else {
        setError(res.error);
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const handleSave = async (): Promise<void> => {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    const res = await authFetch<TMilestone>(`/api/milestones/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || null,
        occurredAt,
      }),
    });
    if (res.ok) {
      goBack();
    } else {
      setError(res.error);
      setSaving(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!window.confirm(t('MILESTONE_PAGE_CONFIRM_DELETE'))) return;
    setDeleting(true);
    setError(null);
    const res = await authFetch<null>(`/api/milestones/${id}`, { method: 'DELETE' });
    if (res.ok) {
      goBack();
    } else {
      setError(res.error);
      setDeleting(false);
    }
  };

  return (
    <PageLayout title={t('MILESTONE_PAGE_EDIT_TITLE')} emoji="🏆" gradient="amber">
      <div className={styles.page}>
        {loading ? (
          <p className={styles.loadingMsg}>{t('COMMON_LOADING')}</p>
        ) : (
          <div className={styles.form}>
            <Input label={t('MILESTONE_PAGE_TITLE_LABEL')} value={title} onChange={setTitle} placeholder={t('MILESTONE_PAGE_TITLE_PLACEHOLDER')} name="milestoneTitle" />
            <Textarea label={t('MILESTONE_PAGE_DESCRIPTION_LABEL')} value={description} onChange={setDescription} placeholder={t('MILESTONE_PAGE_DESCRIPTION_PLACEHOLDER')} name="milestoneDescription" />
            <DateTimeInput label={t('MILESTONE_PAGE_DATE_TIME_LABEL')} value={occurredAt} onChange={setOccurredAt} name="milestoneOccurredAt" />
            {error ? <p className={styles.errorMsg}>⚠️ {error}</p> : null}
            <div className={styles.actions}>
              <Button
                className={styles.saveBtn}
                text={t('COMMON_SAVE')}
                emoji="💾"
                onClick={handleSave}
                loading={saving}
                disabled={!title.trim()}
              />

              <div className={styles.secondaryRow}>
                <Button
                  className={styles.secondaryBtn}
                  text={t('COMMON_CANCEL')}
                  emoji="↩️"
                  variant="secondary"
                  onClick={goBack}
                />

                <Button
                  className={styles.secondaryBtn}
                  text={t('COMMON_DELETE')}
                  emoji="🗑️"
                  variant="ghost"
                  loading={deleting}
                  onClick={handleDelete}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default EditMilestonePage;

