import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../api';
import type { GroupCard, HomePayload, TourCard } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { useGo } from '../nav';
import { colors } from '../theme';
import { Button, Card, Chip, Frame, Loading, Muted, Notice, Title } from '../ui';

const regions = ['ALL', 'SUGHD', 'DUSHANBE', 'DRS', 'KHATLON', 'GBAO'];

export function HomeScreen() {
  const { t, region, category, money } = useI18n();
  const { user } = useAuth();
  const go = useGo();
  const [home, setHome] = useState<HomePayload | null>(null);
  const [groups, setGroups] = useState<GroupCard[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [place, setPlace] = useState('ALL');

  const load = () => {
    setLoading(true);
    setError('');
    void api.home().then(setHome).catch(() => setError(t('common.offline'))).finally(() => setLoading(false));
    if (user) void api.groups().then((rows) => setGroups(rows.slice(0, 3))).catch(() => setGroups([]));
  };
  useEffect(load, [user, t]);

  const tours = (home?.tours ?? []).filter((tour) => place === 'ALL' || tour.region === place || tour.destination?.region === place).slice(0, 6);
  const lead = (home?.popular ?? []).find((item) => place === 'ALL' || item.region === place) ?? home?.popular?.[0];

  return (
    <Frame>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ fontWeight: '800', fontSize: 18, color: colors.text }}>{t('brand.name')}</Text>
          <Muted>{user ? t('home.hello', { name: user.firstName }) : t('home.guest')}</Muted>
        </View>
        <Pressable onPress={() => go.go(user ? 'Notifications' : 'Login')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={user ? 'notifications-outline' : 'person-outline'} size={24} color={colors.text} />
        </Pressable>
      </View>
      {loading ? <Loading /> : null}
      {error && !home ? (
        <>
          <Notice text={error} error />
          <Button label={t('common.retry')} onPress={load} />
        </>
      ) : null}
      {home ? (
        <>
          <View style={{ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12, justifyContent: 'center' }}>
            <Text onPress={() => go.go('Search')} style={{ color: colors.muted }}>{t('home.search')}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label={t('explore.places')} onPress={() => go.go('Explore', { segment: 'places' })} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label={t('explore.tours')} ghost onPress={() => go.go('Explore', { segment: 'tours' })} />
            <Button label={user ? t('tabs.groups') : t('common.account')} ghost onPress={() => (user ? go.go('Main', { screen: 'Groups' }) : go.go('Register', { returnTo: { name: 'Main', params: { screen: 'Groups' } } }))} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {regions.map((item) => (
              <Chip key={item} label={item === 'ALL' ? t('home.where') : region(item)} on={place === item} onPress={() => setPlace(item)} />
            ))}
          </View>
          {lead ? <Card title={lead.name} subtitle={region(lead.region)} image={lead.coverImageUrl} onPress={() => go.go('Destination', { slug: lead.slug })} /> : null}
          {tours.length ? <Title>{t('home.tours')}</Title> : null}
          {tours.map((tour) => (
            <TourRow key={tour.id} tour={tour} money={money} days={t('common.days', { count: tour.durationDays ?? 1 })} onPress={() => go.go('Tour', { slug: tour.slug })} />
          ))}
          {user && groups.length ? <Title>{t('home.groups')}</Title> : null}
          {user ? groups.map((group) => (
            <Card key={group.id} title={group.name} subtitle={`${group.destinationName} · ${group.memberCount}/${group.desiredSize}`} image={group.coverImageUrl} onPress={() => go.go('Group', { id: group.id })} />
          )) : null}
          <Title>{t('home.categories')}</Title>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {home.categories.map((item) => (
              <Chip key={item} label={category(item)} onPress={() => go.go('Explore', { segment: 'places', category: item })} />
            ))}
          </View>
        </>
      ) : null}
    </Frame>
  );
}

function TourRow({ tour, money, days, onPress }: { tour: TourCard; money: (value: string | null | undefined) => string; days: string; onPress: () => void }) {
  const price = tour.pricePerPerson ? money(tour.pricePerPerson) : '';
  return <Card title={tour.title} subtitle={`${tour.destination?.name || tour.destinationName || ''} · ${days}${price ? ` · ${price}` : ''}`} image={tour.coverImageUrl} onPress={onPress} />;
}
