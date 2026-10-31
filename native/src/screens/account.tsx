import { useEffect, useState } from 'react';
import { Image, Pressable, Switch, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import * as api from '../api';
import { ApiError } from '../api';
import { useAuth } from '../auth';
import { mediaUrl } from '../config';
import { useI18n } from '../i18n';
import { pickAndUpload } from '../media';
import { useGo } from '../nav';
import { colors } from '../theme';
import { Button, Field, Frame, Muted, Notice, Title } from '../ui';
import type { Lang } from '../strings';

export function ProfileScreen() {
  const { t } = useI18n();
  const { user, logout, setUser } = useAuth();
  const go = useGo();
  const owner = user && (user.role === 'PROVIDER' || user.role === 'GUIDE' || user.role === 'ADMIN');
  const photo = mediaUrl(user?.avatarUrl);
  return (
    <Frame>
      {user ? (
        <>
          <View style={{ alignItems: 'center', gap: 8 }}>
            {photo ? <Image source={{ uri: photo }} style={{ width: 84, height: 84, borderRadius: 28 }} /> : <View style={{ width: 84, height: 84, borderRadius: 28, backgroundColor: '#E8F1FF', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 32, fontWeight: '800', color: colors.primary }}>{user.firstName.slice(0, 1)}</Text></View>}
            <Title>{`${user.firstName} ${user.lastName}`}</Title>
            <Muted>{user.email}</Muted>
            {user.city ? <Muted>{user.city}</Muted> : null}
          </View>
          {owner ? (
            <>
              <Button label={t('owner.title')} onPress={() => go.go('Owner')} />
              <Button label={t('owner.newTour')} ghost onPress={() => go.go('OwnerTour')} />
            </>
          ) : (
            <Button label={t('owner.become')} onPress={() => void api.setMode('owner').then((next) => { setUser(next); go.go('Owner'); })} />
          )}
          <Button label={t('profile.edit')} ghost onPress={() => go.go('EditProfile')} />
          <Button label={t('profile.messages')} ghost onPress={() => go.go('Messages')} />
          <Button label={t('trips.title')} ghost onPress={() => go.go('Trips')} />
          <Button label={t('stay.title')} ghost onPress={() => go.go('Stays')} />
          <Button label={t('guide.title')} ghost onPress={() => go.go('Guides')} />
          <Button label={t('comp.title')} ghost onPress={() => go.go('Companions')} />
          <Button label={t('home.plannerCta')} ghost onPress={() => go.go('Planner')} />
          <Button label={t('notif.title')} ghost onPress={() => go.go('Notifications')} />
          <Button label={t('profile.language')} ghost onPress={() => go.go('Language')} />
          <Button label={t('profile.settings')} ghost onPress={() => go.go('Settings')} />
          <Button label={t('profile.help')} ghost onPress={() => go.go('Help')} />
          <Button label={t('profile.logout')} ghost onPress={() => void logout().then(() => go.replace('Main'))} />
        </>
      ) : (
        <>
          <Title>{t('brand.name')}</Title>
          <Muted>{t('profile.guest')}</Muted>
          <Button label={t('common.signIn')} onPress={() => go.go('Login')} />
          <Button label={t('common.account')} ghost onPress={() => go.go('Register')} />
          <Button label={t('profile.language')} ghost onPress={() => go.go('Language')} />
          <Button label={t('profile.help')} ghost onPress={() => go.go('Help')} />
        </>
      )}
    </Frame>
  );
}

export function EditProfileScreen() {
  const { t } = useI18n();
  const { user, setUser } = useAuth();
  const go = useGo();
  const company = user?.role === 'PROVIDER';
  const [firstName, setFirst] = useState(user?.firstName ?? '');
  const [lastName, setLast] = useState(user?.lastName ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [interests, setInterests] = useState((user?.interests ?? []).join(', '));
  const [regions, setRegions] = useState((user?.preferredRegions ?? []).join(', '));
  const [avatar, setAvatar] = useState(user?.avatarUrl ?? '');
  const [publicProfile, setPublic] = useState(user?.showProfilePublicly ?? false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const photo = async () => {
    setError('');
    try {
      const url = await pickAndUpload();
      if (url && /^\/uploads\/[a-f0-9]{32}\.(jpe?g|png|webp)$/.test(url)) setAvatar(url);
      else if (url) setError(t('profile.photoType'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('common.offline'));
    }
  };
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const next = await api.updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        city,
        bio,
        showProfilePublicly: publicProfile,
        interests: interests.split(',').map((item) => item.trim()).filter(Boolean),
        preferredRegions: regions.split(',').map((item) => item.trim()).filter(Boolean),
        ...(avatar ? { avatarUrl: avatar } : {}),
      });
      setUser(next);
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('common.offline'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Frame>
      <Button label={t('common.back')} ghost onPress={() => go.back()} />
      <Title>{t('profile.edit')}</Title>
      <Button label={t('profile.photo')} ghost onPress={() => void photo()} />
      {avatar ? <Image source={{ uri: mediaUrl(avatar) }} style={{ width: 96, height: 96, borderRadius: 28 }} /> : null}
      <Field label={t(company ? 'auth.companyName' : 'auth.first')} value={firstName} onChangeText={setFirst} />
      <Field label={t(company ? 'auth.yourName' : 'auth.last')} value={lastName} onChangeText={setLast} />
      <Field label={t('profile.city')} value={city} onChangeText={setCity} />
      <Field label={t('profile.bio')} value={bio} onChangeText={setBio} multiline />
      <Field label={t('profile.interests')} value={interests} onChangeText={setInterests} />
      <Field label={t('profile.regions')} value={regions} onChangeText={setRegions} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
        <Text style={{ color: colors.text }}>{t('comp.title')}</Text>
        <Switch value={publicProfile} onValueChange={setPublic} />
      </View>
      {error ? <Notice text={error} error /> : null}
      {saved ? <Notice text={t('common.save')} /> : null}
      <Button label={t('common.save')} onPress={() => void save()} disabled={busy || !firstName.trim() || !lastName.trim()} />
    </Frame>
  );
}

export function SettingsScreen() {
  const { t } = useI18n();
  const { user, setUser } = useAuth();
  const go = useGo();
  const [bookings, setBookings] = useState(user?.notifyBookings ?? true);
  const [companions, setCompanions] = useState(user?.notifyCompanions ?? true);
  const [marketing, setMarketing] = useState(user?.notifyMarketing ?? false);
  const [message, setMessage] = useState('');
  if (!user) {
    return <Frame><Button label={t('common.signIn')} onPress={() => go.go('Login')} /></Frame>;
  }
  return (
    <Frame>
      <Button label={t('common.back')} ghost onPress={() => go.back()} />
      <Title>{t('profile.settings')}</Title>
      <Row label={t('settings.bookings')} value={bookings} onChange={setBookings} />
      <Row label={t('settings.companions')} value={companions} onChange={setCompanions} />
      <Row label={t('settings.marketing')} value={marketing} onChange={setMarketing} />
      <Button label={t('common.save')} ghost onPress={() => void api.updateProfile({ notifyBookings: bookings, notifyCompanions: companions, notifyMarketing: marketing }).then((next) => { setUser(next); setMessage(t('common.save')); })} />
      <Title>{t('settings.security')}</Title>
      <Muted>{t('auth.passwordHint')}</Muted>
      <Button label={t('auth.changePin')} onPress={() => go.go('Forgot', { email: user.email })} />
      {message ? <Notice text={message} /> : null}
      <Button label={t('settings.delete')} ghost onPress={() => void api.requestDeletion().then((result) => setMessage(result.message))} />
    </Frame>
  );
}

function Row({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
      <Text style={{ color: colors.text, flex: 1 }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

export function LanguageScreen() {
  const { t, lang, setLang } = useI18n();
  const { user } = useAuth();
  const go = useGo();
  const choose = (next: Lang) => {
    setLang(next);
    if (user) void api.updateProfile({ language: next });
  };
  return (
    <Frame>
      <Button label={t('common.back')} ghost onPress={() => go.back()} />
      <Title>{t('lang.title')}</Title>
      {(['tg', 'ru', 'en'] as Lang[]).map((item) => (
        <Button key={item} label={t(`lang.${item}`)} ghost={lang !== item} onPress={() => choose(item)} />
      ))}
    </Frame>
  );
}

export function HelpScreen() {
  const { t } = useI18n();
  const go = useGo();
  return (
    <Frame>
      <Button label={t('common.back')} ghost onPress={() => go.back()} />
      <Title>{t('help.title')}</Title>
      <Muted>{t('help.body')}</Muted>
      <Muted>support@rohi.local</Muted>
      <Notice text={t('home.note')} />
    </Frame>
  );
}

export function NotificationsScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const go = useGo();
  const [rows, setRows] = useState<{ id: string; title: string; body: string; readAt: string | null }[]>([]);
  useEffect(() => {
    if (user) void api.notifications().then(setRows).catch(() => setRows([]));
  }, [user]);
  return (
    <Frame>
      <Button label={t('common.back')} ghost onPress={() => go.back()} />
      <Title>{t('notif.title')}</Title>
      {!user ? <Button label={t('common.signIn')} onPress={() => go.go('Login')} /> : null}
      {user && !rows.length ? <Muted>{t('notif.empty')}</Muted> : null}
      {rows.map((item) => (
        <Pressable key={item.id} onPress={() => void api.readNotification(item.id)}>
          <Title>{item.title}</Title>
          <Muted>{item.body}</Muted>
        </Pressable>
      ))}
    </Frame>
  );
}
