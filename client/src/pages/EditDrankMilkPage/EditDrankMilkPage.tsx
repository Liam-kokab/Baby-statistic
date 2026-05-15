import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetch2 } from 'baby-statistic-common/util';
import type { TDrankMilk, TDrankMilkSource } from 'baby-statistic-common';
import PageLayout from '../../components/PageLayout/PageLayout';
import DateTimeInput from '../../components/DateTimeInput/DateTimeInput';
import Button from '../../components/Button/Button';
import styles from './EditDrankMilkPage.module.css';

const toInputValue = (isoStr: string): string => isoStr.slice(0, 16);

const EditDrankMilkPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [amount, setAmount] = useState('');
  const [source, setSource] = useState<TDrankMilkSource>('FRIDGE');
  const [createdAt, setCreatedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goBack = (): void => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/milk-drank');
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await fetch2<TDrankMilk>(`/api/drank-milk/${id}`);
      if (result.ok) {
        setAmount(String(result.data.amount));
        setSource(result.data.source);
        setCreatedAt(toInputValue(result.data.createdAt));
      } else {
        setError(result.error);
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const handleSubmit = async () => {
    const parsedAmount = Number(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Amount must be a positive number');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await fetch2<TDrankMilk>(`/api/drank-milk/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parsedAmount, source, createdAt }),
    });
    if (result.ok) {
      goBack();
    } else {
      setError(result.error);
      setSaving(false);
    }
  };

  return (
    <PageLayout title="Edit Drank Milk" emoji="🍼" gradient="green">
      <div className={styles.page}>
        {loading ? (
          <p className={styles.loadingMsg}>Loading… ⏳</p>
        ) : (
          <div className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="amount">Amount (ml)</label>
              <input
                id="amount"
                className={styles.input}
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="source">Source</label>
              <select
                id="source"
                className={styles.select}
                value={source}
                onChange={(e) => setSource(e.target.value as TDrankMilkSource)}
              >
                <option value="FRIDGE">🥛 FRIDGE</option>
                <option value="FREEZER">❄️ FREEZER</option>
                <option value="BOOB">🤱 BOOB</option>
              </select>
            </div>
            <DateTimeInput
              label="Time"
              name="createdAt"
              value={createdAt}
              onChange={setCreatedAt}
            />
            {error ? <p className={styles.errorMsg}>⚠️ {error}</p> : null}
            <div className={styles.actions}>
              <Button text="Save" emoji="💾" onClick={handleSubmit} loading={saving} />
              <Button text="Cancel" emoji="↩️" variant="secondary" onClick={goBack} />
              <Button
                text="Delete"
                emoji="🗑️"
                variant="ghost"
                loading={deleting}
                onClick={async () => {
                  setDeleting(true);
                  setError(null);
                  const res = await fetch2<null>(`/api/drank-milk/${id}`, { method: 'DELETE' });
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
        )}
      </div>
    </PageLayout>
  );
};

export default EditDrankMilkPage;

