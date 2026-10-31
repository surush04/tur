import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import * as api from '../api';
import type { Destination, GuideCard, GroupCard, Reel, StayCard, TourCard } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { useGo } from '../nav';
import { Button, Card, Chip, Field, Frame, Loading, Muted, Notice, Title } from '../ui';

function Row({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>;
}

export function ExploreScreen() {
  const { t, region, category } = useI18n();
  const go = useGo();
  const params = (useRoute().params as { segment?: string; category?: string } | undefined) ?? {};
  const [segment, setSegment] = useState(params.segment === 'tours' ? 'tours' : 'places');
  const [cat, setCat] = useState(params.category ?? '');
  const [places, setPlaces] = useState<Destination[]>([]);
  const [offers, setOffers] = useState<TourCard[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.destinations(cat ? { category: cat } : {}), api.tours(cat ? { category: cat } : {})])
      .then(([left, right]) => {
        setPlaces(left);
        setOffers(right);
      })
      .catch(() => setError(t('common.offline')))
      .finally(() => setLoading(false));
  }, [cat, t]);

  return (
    <Frame>
      <Title>{t('tabs.explore')}</Title>
      <Row>
        <Chip label={t('explore.places')} on={segment === 'places'} onPress={() => setSegment('places')} />
        <Chip label={t('explore.tours')} on={segment === 'tours'} onPress={() => setSegment('tours')} />
      </Row>
      <Row>
        <Chip label={t('home.where')} on={!cat} onPress={() => setCat('')} />
        {['LAKES', 'MOUNTAINS', 'CITIES', 'CULTURE', 'ROAD', 'NATURE'].map((item) => (
          <Chip key={item} label={category(item)} on={cat === item} onPress={() => setCat(item)} />
        ))}
      </Row>
      {loading ? <Loading /> : null}
      {error ? <Notice text={error} error /> : null}
      {segment === 'places'
        ? places.map((item) => (
            <Card key={item.id} title={item.name} subtitle={region(item.region)} image={item.coverImageUrl} onPress={() => go.go('Destination', { slug: item.slug })} />
          ))
        : offers.map((item) => (
            <Card key={item.id} title={item.title} subtitle={item.destination?.name || item.destinationName} image={item.coverImageUrl} onPress={() => go.go('Tour', { slug: item.slug })} />
          ))}
      {!loading && !(segment === 'places' ? places : offers).length ? <Muted>{t('explore.empty')}</Muted> : null}
    </Frame>
  );
}

export function DestinationScreen() {
  const { t, region } = useI18n();
  const go = useGo();
  const slug = (useRoute().params as { slug: string }).slug;
  const [item, setItem] = useState<Destination | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    void api.destination(slug).then(setItem).catch(() => setError(t('common.offline')));
  }, [slug, t]);
  return (
    <Frame>
      <Button label={t('common.back')} ghost onPress={() => go.back()} />
      {error ? <Notice text={error} error /> : null}
      {item ? (
        <>
          <Card title={item.name} subtitle={region(item.region)} image={item.coverImageUrl} />
          <Muted>{item.summary}</Muted>
          {item.description ? <Muted>{item.description}</Muted> : null}
          {(item.tours ?? []).map((tour) => (
            <Card key={tour.id} title={tour.title} image={tour.coverImageUrl} onPress={() => go.go('Tour', { slug: tour.slug })} />
          ))}
        </>
      ) : null}
    </Frame>
  );
}

export function SearchScreen() {
  const { t } = useI18n();
  const go = useGo();
  const [q, setQ] = useState('');
  const [found, setFound] = useState<TourCard[]>([]);
  const [groups, setGroups] = useState<GroupCard[]>([]);
  const [videos, setVideos] = useState<Reel[]>([]);
  const [error, setError] = useState('');
  const run = async () => {
    setError('');
    try {
      const [tourRows, social] = await Promise.all([api.tours({ q }), api.searchSocial(q)]);
      setFound(tourRows);
      setGroups(social.groups);
      setVideos(social.videos);
    } catch {
      setError(t('common.offline'));
    }
  };
  return (
    <Frame>
      <Button label={t('common.back')} ghost onPress={() => go.back()} />
      <Title>{t('home.search')}</Title>
      <Field label={t('home.search')} value={q} onChangeText={setQ} />
      <Button label={t('home.search')} onPress={() => void run()} disabled={q.trim().length < 2} />
      {error ? <Notice text={error} error /> : null}
      {found.map((item) => <Card key={item.id} title={item.title} image={item.coverImageUrl} onPress={() => go.go('Tour', { slug: item.slug })} />)}
      {groups.map((group) => <Card key={group.id} title={group.name} subtitle={group.destinationName} image={group.coverImageUrl} onPress={() => go.go('Group', { id: group.id })} />)}
      {videos.map((video) => <Card key={video.id} title={video.caption} subtitle={video.destinationName} image={video.posterUrl} />)}
    </Frame>
  );
}

export function StaysScreen() {
  const { t, money } = useI18n();
  const go = useGo();
  const [rows, setRows] = useState<StayCard[]>([]);
  useEffect(() => {
    void api.stays().then(setRows).catch(() => setRows([]));
  }, []);
  return (
    <Frame>
      <Button label={t('common.back')} ghost onPress={() => go.back()} />
      <Title>{t('stay.title')}</Title>
      {rows.map((item) => (
        <Card key={item.id} title={item.name} subtitle={[item.region, item.priceRangeMin ? money(item.priceRangeMin) : ''].filter(Boolean).join(' · ')} image={item.coverImageUrl} onPress={() => go.go('Stay', { slug: item.slug })} />
      ))}
    </Frame>
  );
}

export function StayScreen() {
  const { t, money } = useI18n();
  const { user } = useAuth();
  const go = useGo();
  const slug = (useRoute().params as { slug: string }).slug;
  const [item, setItem] = useState<StayCard | null>(null);
  useEffect(() => {
    void api.stay(slug).then(setItem).catch(() => setItem(null));
  }, [slug]);
  return (
    <Frame>
      <Button label={t('common.back')} ghost onPress={() => go.back()} />
      {item ? (
        <>
          <Card title={item.name} subtitle={item.region} image={item.coverImageUrl} />
          <Muted>{item.summary}</Muted>
          {item.description ? <Muted>{item.description}</Muted> : null}
          {item.priceRangeMin ? <Muted>{money(item.priceRangeMin)}</Muted> : null}
          {user && item.contactPhone ? <Muted>{item.contactPhone}</Muted> : <Muted>{t('gate.number')}</Muted>}
        </>
      ) : (
        <Loading />
      )}
    </Frame>
  );
}

export function GuidesScreen() {
  const { t, region } = useI18n();
  const go = useGo();
  const [rows, setRows] = useState<GuideCard[]>([]);
  useEffect(() => {
    void api.guides().then(setRows).catch(() => setRows([]));
  }, []);
  return (
    <Frame>
      <Button label={t('common.back')} ghost onPress={() => go.back()} />
      <Title>{t('guide.title')}</Title>
      {rows.map((item) => (
        <Card key={item.id} title={item.displayName} subtitle={region(item.region)} image={item.coverImageUrl} onPress={() => go.go('Guide', { id: item.id })} />
      ))}
    </Frame>
  );
}

export function GuideScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const go = useGo();
  const id = (useRoute().params as { id: string }).id;
  const [item, setItem] = useState<GuideCard | null>(null);
  useEffect(() => {
    void api.guide(id).then(setItem).catch(() => setItem(null));
  }, [id]);
  return (
    <Frame>
      <Button label={t('common.back')} ghost onPress={() => go.back()} />
      {item ? (
        <>
          <Title>{item.displayName}</Title>
          {item.bio ? <Muted>{item.bio}</Muted> : null}
          {item.priceNote ? <Muted>{item.priceNote}</Muted> : null}
          {user && item.contactPhone ? <Muted>{item.contactPhone}</Muted> : <Muted>{t('gate.number')}</Muted>}
        </>
      ) : (
        <Loading />
      )}
    </Frame>
  );
}
