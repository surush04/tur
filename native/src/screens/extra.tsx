import { useEffect, useState } from 'react';
import * as api from '../api';
import { ApiError, type BookingRecord } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { useGo } from '../nav';
import { Button, Card, Field, Frame, Muted, Notice, Title } from '../ui';

export function FavoritesScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const go = useGo();
  const [rows, setRows] = useState<{ id: string; title: string; subtitle: string; image?: string | null; href: string }[]>([]);
  useEffect(() => {
    if (user) void api.favorites().then(setRows).catch(() => setRows([]));
  }, [user]);
  if (!user) {
    return (
      <Frame>
        <Title>{t('tabs.favorites')}</Title>
        <Muted>{t('gate.number')}</Muted>
        <Button label={t('common.account')} onPress={() => go.go('Register', { returnTo: { name: 'Main', params: { screen: 'Favorites' } } })} />
      </Frame>
    );
  }
  return (
    <Frame>
      <Title>{t('tabs.favorites')}</Title>
      {rows.map((item) => (
        <Card key={item.id} title={item.title} subtitle={item.subtitle} image={item.image} onPress={() => openHref(item.href, go)} />
      ))}
      {!rows.length ? <Muted>{t('explore.empty')}</Muted> : null}
    </Frame>
  );
}

function openHref(href: string, go: ReturnType<typeof useGo>) {
  const tour = href.match(/tour\/([^/?]+)/);
  const place = href.match(/destination\/([^/?]+)/);
  if (tour) go.go('Tour', { slug: tour[1] });
  else if (place) go.go('Destination', { slug: place[1] });
  else if (href.includes('/stay/')) go.go('Stay', { slug: href.split('/stay/')[1] });
  else if (href.includes('/guide/')) go.go('Guide', { id: href.split('/guide/')[1] });
}

export function TripsScreen() {
  const { t, money } = useI18n();
  const go = useGo();
  const [rows, setRows] = useState<BookingRecord[]>([]);
  useEffect(() => {
    void api.bookings().then(setRows).catch(() => setRows([]));
  }, []);
  return (
    <Frame>
      <Button label={t('common.back')} ghost onPress={() => go.back()} />
      <Title>{t('trips.title')}</Title>
      {rows.map((item) => (
        <Card key={item.id} title={item.tour.title} subtitle={`${item.status} · ${money(item.totalPrice)}`} onPress={() => go.go('Trip', { id: item.id })} />
      ))}
      {!rows.length ? <Muted>{t('trips.empty')}</Muted> : null}
    </Frame>
  );
}

export function CompanionsScreen() {
  const { t } = useI18n();
  const go = useGo();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  useEffect(() => {
    void api.companions().then(setRows).catch(() => setRows([]));
  }, []);
  return (
    <Frame>
      <Button label={t('common.back')} ghost onPress={() => go.back()} />
      <Title>{t('comp.title')}</Title>
      {rows.map((item) => (
        <Card key={String(item.id)} title={String(item.title || item.destination || t('comp.title'))} subtitle={String(item.summary || item.region || '')} />
      ))}
    </Frame>
  );
}

export function PlannerScreen() {
  const { t } = useI18n();
  const go = useGo();
  const [start, setStart] = useState('Dushanbe');
  const [travelers, setTravelers] = useState('2');
  const [budget, setBudget] = useState('1500');
  const [interests, setInterests] = useState('mountains, lakes');
  const [plan, setPlan] = useState<{ title: string; source: string; days: { title: string; activities: { title: string }[] }[] } | null>(null);
  const [error, setError] = useState('');
  const run = async () => {
    setError('');
    try {
      setPlan(await api.plan({
        startLocation: start.trim(),
        travelers: Number(travelers) || 1,
        budgetTjs: budget.trim(),
        interests: interests.split(',').map((item) => item.trim()).filter(Boolean),
        demo: true,
      }));
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('common.offline'));
    }
  };
  return (
    <Frame>
      <Button label={t('common.back')} ghost onPress={() => go.back()} />
      <Title>{t('home.plannerCta')}</Title>
      <Muted>{t('home.note')}</Muted>
      <Field label={t('group.destination')} value={start} onChangeText={setStart} />
      <Field label={t('book.travelers')} value={travelers} onChangeText={setTravelers} keyboard="number-pad" />
      <Field label={t('group.budget')} value={budget} onChangeText={setBudget} keyboard="decimal-pad" />
      <Field label={t('profile.interests')} value={interests} onChangeText={setInterests} />
      {error ? <Notice text={error} error /> : null}
      <Button label={t('home.plannerCta')} onPress={() => void run()} />
      {plan ? <Title>{`${plan.title} · ${plan.source}`}</Title> : null}
      {plan?.days.map((day) => (
        <Muted key={day.title}>{`${day.title}: ${day.activities.map((item) => item.title).join(', ')}`}</Muted>
      ))}
    </Frame>
  );
}
