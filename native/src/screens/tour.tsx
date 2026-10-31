import { useEffect, useState } from 'react';
import { Linking, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import * as api from '../api';
import { ApiError, type TourDetail } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { useGo } from '../nav';
import { colors } from '../theme';
import { Button, Card, Field, Frame, Loading, Muted, Notice, Title } from '../ui';

export function TourScreen() {
  const { t, money } = useI18n();
  const { user } = useAuth();
  const go = useGo();
  const slug = (useRoute().params as { slug: string }).slug;
  const [item, setItem] = useState<TourDetail | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    void api.tour(slug).then(setItem).catch(() => setError(t('common.offline')));
  }, [slug, t]);

  const favorite = async () => {
    if (!user) {
      go.go('Register', { returnTo: { name: 'Tour', params: { slug } } });
      return;
    }
    if (!item) return;
    try {
      await api.addFavorite({ tourId: item.id });
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('common.offline'));
    }
  };

  const write = async () => {
    if (!user || !item) {
      go.go('Register', { returnTo: { name: 'Tour', params: { slug } } });
      return;
    }
    const chat = await api.messageOperator(item.id, t('tour.write'));
    go.go('Conversation', { id: chat.id });
  };

  return (
    <Frame>
      <Button label={t('common.back')} ghost onPress={() => go.back()} />
      {error ? <Notice text={error} error /> : null}
      {!item && !error ? <Loading /> : null}
      {item ? (
        <>
          <Card title={item.title} subtitle={item.destination?.name || item.destinationName} image={item.coverImageUrl} />
          <Muted>{item.summary}</Muted>
          {item.pricePerPerson ? <Title>{money(item.pricePerPerson)}</Title> : null}
          <Muted>{t('common.days', { count: item.durationDays ?? 1 })}</Muted>
          {item.description ? <Muted>{item.description}</Muted> : null}
          {item.meetingPoint ? <Muted>{item.meetingPoint}</Muted> : null}
          <Pressable onPress={() => void favorite()} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name={saved ? 'heart' : 'heart-outline'} size={22} color={colors.primary} />
            <Text style={{ color: colors.text, fontWeight: '700' }}>{t('common.save')}</Text>
          </Pressable>
          {user ? (
            <>
              <Button label={t('tour.book')} onPress={() => go.go('Booking', { slug })} />
              <Button label={t('tour.write')} ghost onPress={() => void write()} />
              {item.owner?.telegram ? <Button label={t('tour.telegram')} ghost onPress={() => void Linking.openURL(`https://t.me/${item.owner?.telegram}`)} /> : null}
              {item.owner?.whatsapp ? <Button label={t('tour.whatsapp')} ghost onPress={() => void Linking.openURL(`https://wa.me/${(item.owner?.whatsapp ?? '').replace(/\D/g, '')}`)} /> : null}
              {item.owner?.phone ? <Muted>{`${t('tour.phone')}: ${item.owner.phone}`}</Muted> : null}
            </>
          ) : (
            <>
              <Muted>{t('gate.number')}</Muted>
              <Button label={t('common.account')} onPress={() => go.go('Register', { returnTo: { name: 'Tour', params: { slug } } })} />
            </>
          )}
        </>
      ) : null}
    </Frame>
  );
}

export function BookingScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const go = useGo();
  const slug = (useRoute().params as { slug: string }).slug;
  const [item, setItem] = useState<TourDetail | null>(null);
  const [dateId, setDateId] = useState('');
  const [name, setName] = useState(user ? `${user.firstName} ${user.lastName}` : '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void api.tour(slug).then((tour) => {
      setItem(tour);
      setDateId(tour.dates?.[0]?.id ?? '');
    }).catch(() => setError(t('common.offline')));
  }, [slug, t]);
  const submit = async () => {
    if (!user) {
      go.go('Login', { returnTo: { name: 'Booking', params: { slug } } });
      return;
    }
    setBusy(true);
    setError('');
    try {
      const saved = await api.createBooking({
        tourDateId: dateId,
        travelers: 1,
        contactName: name.trim(),
        contactEmail: email.trim(),
        contactPhone: phone.trim(),
        notes,
        travelerNames: [{ fullName: name.trim() }],
      });
      go.replace('Trip', { id: saved.id });
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('common.offline'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Frame>
      <Button label={t('common.back')} ghost onPress={() => go.back()} />
      <Title>{t('tour.book')}</Title>
      {item ? <Muted>{item.title}</Muted> : null}
      {(item?.dates ?? []).map((date) => (
        <Button key={date.id} label={`${date.startDate.slice(0, 10)} · ${date.remaining}`} ghost={dateId !== date.id} onPress={() => setDateId(date.id)} />
      ))}
      <Field label={t('auth.first')} value={name} onChangeText={setName} />
      <Field label={t('auth.email')} value={email} onChangeText={setEmail} keyboard="email-address" />
      <Field label={t('tour.phone')} value={phone} onChangeText={setPhone} keyboard="phone-pad" />
      <Field label={t('profile.bio')} value={notes} onChangeText={setNotes} multiline />
      {error ? <Notice text={error} error /> : null}
      <Button label={t('common.save')} onPress={() => void submit()} disabled={busy || !dateId || name.trim().length < 2 || phone.trim().length < 6 || !email.includes('@')} />
      <Muted>{t('home.note')}</Muted>
    </Frame>
  );
}

export function TripScreen() {
  const { t, money } = useI18n();
  const go = useGo();
  const id = (useRoute().params as { id: string }).id;
  const [item, setItem] = useState<api.BookingRecord | null>(null);
  useEffect(() => {
    void api.booking(id).then(setItem).catch(() => setItem(null));
  }, [id]);
  return (
    <Frame>
      <Button label={t('common.back')} ghost onPress={() => go.back()} />
      <Title>{t('book.reference')}</Title>
      {item ? (
        <>
          <Title>{item.reference}</Title>
          <Muted>{item.tour.title}</Muted>
          <Muted>{item.status}</Muted>
          <Muted>{item.paymentNote}</Muted>
          {item.totalPrice ? <Muted>{money(item.totalPrice)}</Muted> : null}
        </>
      ) : <Loading />}
    </Frame>
  );
}
