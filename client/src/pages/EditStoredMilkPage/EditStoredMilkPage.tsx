import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authFetch } from '../../utils/authFetch';
import type { TServedMilk, TServedMilkStatus } from 'baby-statistic-common';
import PageLayout from '../../components/PageLayout/PageLayout';
import DateTimeInput from '../../components/DateTimeInput/DateTimeInput';
import Button from '../../components/Button/Button';
import { useTranslation } from '../../i18n/i18n';
import styles from './EditStoredMilkPage.module.css';

const VALID_STATUSES: TServedMilkStatus[] = ['FRIDGE', 'FREEZER', 'USED', 'EXPIRED'];

const STATUS_EMOJI: Record<TServedMilkStatus, string> = {
  FRIDGE:  '🥛',
  FREEZER: '❄️',
  USED:    '✅',
  EXPIRED: '⚠️',
};

const toInputValue = (isoStr: string): string => isoStr.slice(0, 16);

const EditStoredMilkPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [amount, setAmount] = useState('');
  const [originalAmount, setOriginalAmount] = useState('');
  const [status, setStatus] = useState<TServedMilkStatus>('FRIDGE');
  const [expiryDate, setExpiryDate] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goBack = (): void => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/milk-saved');
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await authFetch<TServedMilk>(`/api/served-milk/${id}`);
      if (result.ok) {
        const { data } = result;
        setAmount(String(data.amount));
        setOriginalAmount(String(data.originalAmount));
        setStatus(data.status);
        setExpiryDate(data.expiryDate ? toInputValue(data.expiryDate) : '');
        setCreatedAt(toInputValue(data.createdAt));
      } else {
        setError(result.error);
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const handleSubmit = async () => {
    const parsedAmount = Number(amount);
    const parsedOriginal = Number(originalAmount);
    if (!amount || isNaN(parsedAmount) || parsedAmount < 0) {
      setError(t('EDIT_AMOUNT_NON_NEGATIVE'));
      return;
    }
    if (!originalAmount || isNaN(parsedOriginal) || parsedOriginal <= 0) {
      setError(t('EDIT_ORIGINAL_AMOUNT_POSITIVE'));
      return;
    }
    setSaving(true);
    setError(null);
    const result = await authFetch<TServedMilk>(`/api/served-milk/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: parsedAmount,
        originalAmount: parsedOriginal,
        status,
        expiryDate: expiryDate || null,
        createdAt,
      }),
    });
    if (result.ok) {
      goBack();
    } else {
      setError(result.error);
      setSaving(false);
    }
  };

  return (
    <PageLayout title={t('EDIT_STORED_MILK_TITLE')} emoji="🧊" gradient="blue">
      <div className={styles.page}>
        {loading ? (
          <p className={styles.loadingMsg}>{t('COMMON_LOADING')}</p>
        ) : (
          <div className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="amount">{t('EDIT_AMOUNT_ML')}</label>
              <input
                id="amount"
                className={styles.input}
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="originalAmount">{t('EDIT_ORIGINAL_AMOUNT_ML')}</label>
              <input
                id="originalAmount"
                className={styles.input}
                type="number"
                min="1"
                value={originalAmount}
                onChange={(e) => setOriginalAmount(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="status">{t('COMMON_STATUS')}</label>
              <select
                id="status"
                className={styles.select}
                value={status}
                onChange={(e) => setStatus(e.target.value as TServedMilkStatus)}
              >
                {VALID_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_EMOJI[s]} {s}</option>
                ))}
              </select>
            </div>
            <div className={styles.fieldGroup}>
              <DateTimeInput
                label={t('EDIT_EXPIRY_DATE_OPTIONAL')}
                name="expiryDate"
                value={expiryDate}
                onChange={setExpiryDate}
              />
              {expiryDate ? (
                <button type="button" className={styles.clearBtn} onClick={() => setExpiryDate('')}>
                  {t('EDIT_CLEAR_EXPIRY_DATE')}
                </button>
              ) : null}
            </div>
            <DateTimeInput
              label={t('COMMON_CREATED_AT')}
              name="createdAt"
              value={createdAt}
              onChange={setCreatedAt}
            />
            {error ? <p className={styles.errorMsg}>⚠️ {error}</p> : null}
            <div className={styles.actions}>
              <Button
                className={styles.saveBtn}
                text={t('COMMON_SAVE')}
                emoji="💾"
                onClick={handleSubmit}
                loading={saving}
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
                  onClick={async () => {
                    setDeleting(true);
                    setError(null);
                    const res = await authFetch<null>(`/api/served-milk/${id}`, { method: 'DELETE' });
                    if (res.ok) {
                      goBack();
                    } else {
                      setError(res.error);
                      setDeleting(false);
                    }
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default EditStoredMilkPage;

