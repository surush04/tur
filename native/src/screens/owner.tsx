import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import * as api from '../api';
import { ApiError, type Destination } from '../api';
import { useI18n } from '../i18n';
import { pickAndUpload } from '../media';
import { useGo } from '../nav';
import { Button, Card, Field, Frame, Loading, Muted, Notice, Photo, Title } from '../ui';

export function OwnerScreen() {
  const { t, money } = useI18n();
  const go = useGo();
  const [data, setData] = useState<Awaited<ReturnType<typeof api.ownerDashboard>> | null>(null);
  const [telegram, setTelegram] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    void api.ownerDashboard().then(setData).catch(() => setError(t('common.offline')));
  }, [t]);
  return (
    <Frame>
      <Button label={t('common.back')} ghost onPress={() => go.back()} />
      <Title>{t('owner.title')}</Title>
      <Muted>{t('owner.studioLead')}</Muted>
      {error ? <Notice text={error} error /> : null}
      {data ? <Muted>{`${t('owner.views')}: ${data.views}`}</Muted> : <Loading />}
      <Field label="Telegram" value={telegram} onChangeText={setTelegram} />
      <Field label="WhatsApp" value={whatsapp} onChangeText={setWhatsapp} />
      <Button label={t('common.save')} ghost onPress={() => void api.updateProfile({ telegramHandle: telegram, whatsappHandle: whatsapp })} />
      <Button label={t('owner.newTour')} onPress={() => go.go('OwnerTour')} />
      <Button label={t('owner.reel')} ghost onPress={() => go.go('ReelNew')} />
      <Button label={t('owner.group')} ghost onPress={() => go.go('GroupNew')} />
      {(data?.tours ?? []).map((tour) => (
        <Card key={tour.id} title={tour.title} subtitle={`${tour.published ? t('owner.live') : t('owner.pending')} · ${tour.viewCount} · ${money(tour.pricePerPerson)}`} onPress={() => go.go('OwnerTour', { id: tour.id })} />
      ))}
      {(data?.groups ?? []).map((group) => (
        <Card key={group.id} title={group.name} subtitle={`${group.memberCount}/${group.desiredSize}`} onPress={() => go.go('Group', { id: group.id })} />
      ))}
    </Frame>
  );
}

export function OwnerTourScreen() {
  const { t, category, region } = useI18n();
  const go = useGo();
  const id = (useRoute().params as { id?: string } | undefined)?.id;
  const [places, setPlaces] = useState<Destination[]>([]);
  const [destinationId, setDestination] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [cat, setCat] = useState('CITIES');
  const [level, setLevel] = useState('MODERATE');
  const [days, setDays] = useState('1');
  const [price, setPrice] = useState('');
  const [meeting, setMeeting] = useState('');
  const [phone, setPhone] = useState('');
  const [included, setIncluded] = useState('');
  const [cover, setCover] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [video, setVideo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void api.destinations({}).then((rows) => {
      setPlaces(rows);
      if (!id && rows[0]) setDestination(rows[0].id);
    }).catch(() => setError(t('common.offline')));
    if (id) {
      void api.ownerTour(id).then((tour) => {
        setDestination(tour.destinationId);
        setTitle(tour.title);
        setSummary(tour.summary);
        setDescription(tour.description);
        setCat(tour.category);
        setLevel(tour.difficulty);
        setDays(String(tour.durationDays));
        setPrice(tour.pricePerPerson ?? '');
        setMeeting(tour.meetingPoint);
        setPhone(tour.contactPhone ?? '');
        setIncluded(tour.included ?? '');
        setCover(tour.coverImageUrl ?? '');
        setPhotos(tour.imageUrls ?? []);
      }).catch(() => setError(t('common.offline')));
    }
  }, [t, id]);
  const upload = async (kind: 'image' | 'video', target: 'cover' | 'photos' | 'video') => {
    setError('');
    try {
      const url = await pickAndUpload(kind);
      if (!url) return;
      if (target === 'cover') setCover(url);
      else if (target === 'video') setVideo(url);
      else setPhotos((list) => [...list, url].slice(0, 8));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('common.offline'));
    }
  };
  const save = async () => {
    if (video && !cover && !photos.length) {
      setError(t('owner.videoNote'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const saved = await api.saveOwnerTour({
        destinationId,
        title: title.trim(),
        summary: summary.trim(),
        description: description.trim(),
        category: cat,
        difficulty: level,
        durationDays: Number(days) || 1,
        pricePerPerson: price.trim(),
        meetingPoint: meeting.trim(),
        contactPhone: phone.trim(),
        included: included.trim(),
        published: true,
        ...(cover ? { coverImageUrl: cover } : {}),
        ...(photos.length ? { imageUrls: photos } : {}),
      }, id);
      if (video) {
        const place = places.find((item) => item.id === destinationId);
        await api.publishReel({
          caption: title.trim(),
          destinationName: place?.name || title.trim(),
          region: place?.region || 'SUGHD',
          posterUrl: cover || photos[0],
          videoUrl: video,
          tourId: saved.id,
        });
      }
      go.replace('Owner');
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('common.offline'));
    } finally {
      setBusy(false);
    }
  };
  const place = places.find((item) => item.id === destinationId);
  return (
    <Frame>
      <Button label={t('common.back')} ghost onPress={() => go.back()} />
      <Title>{t('owner.newTour')}</Title>
      <Muted>{place ? `${place.name} · ${region(place.region)}` : ''}</Muted>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {places.slice(0, 8).map((item) => (
          <Button key={item.id} label={item.name} ghost={destinationId !== item.id} onPress={() => setDestination(item.id)} />
        ))}
      </View>
      <Field label={t('owner.tourName')} value={title} onChangeText={setTitle} />
      <Field label={t('owner.about')} value={summary} onChangeText={setSummary} />
      <Field label={t('owner.about')} value={description} onChangeText={setDescription} multiline />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {['CITIES', 'LAKES', 'MOUNTAINS', 'CULTURE', 'ROAD', 'NATURE'].map((item) => (
          <Button key={item} label={category(item)} ghost={cat !== item} onPress={() => setCat(item)} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {['EASY', 'MODERATE', 'CHALLENGING', 'STRENUOUS'].map((item) => (
          <Button key={item} label={item} ghost={level !== item} onPress={() => setLevel(item)} />
        ))}
      </View>
      <Field label={t('common.days', { count: Number(days) || 1 })} value={days} onChangeText={setDays} keyboard="number-pad" />
      <Field label={t('common.perPerson')} value={price} onChangeText={setPrice} keyboard="decimal-pad" />
      <Field label={t('tour.meeting')} value={meeting} onChangeText={setMeeting} />
      <Field label={t('owner.phone')} value={phone} onChangeText={setPhone} keyboard="phone-pad" />
      <Field label={t('tour.included')} value={included} onChangeText={setIncluded} />
      <Button label={t('owner.icon')} ghost onPress={() => void upload('image', 'cover')} />
      {cover ? <Photo url={cover} height={120} /> : null}
      <Button label={t('owner.photos')} ghost onPress={() => void upload('image', 'photos')} />
      <Button label={t('owner.video')} ghost onPress={() => void upload('video', 'video')} />
      <Muted>{t('owner.videoNote')}</Muted>
      {error ? <Notice text={error} error /> : null}
      <Button label={t('common.save')} onPress={() => void save()} disabled={busy || title.trim().length < 2 || summary.trim().length < 2 || description.trim().length < 2 || !price.trim() || !meeting.trim() || !destinationId} />
    </Frame>
  );
}

export function ReelNewScreen() {
  const { t, region } = useI18n();
  const go = useGo();
  const [caption, setCaption] = useState('');
  const [place, setPlace] = useState('');
  const [area, setArea] = useState('SUGHD');
  const [poster, setPoster] = useState('');
  const [video, setVideo] = useState('');
  const [error, setError] = useState('');
  const save = async () => {
    try {
      await api.publishReel({ caption: caption.trim(), destinationName: place.trim(), region: area, posterUrl: poster, videoUrl: video });
      go.back();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('common.offline'));
    }
  };
  return (
    <Frame>
      <Button label={t('common.back')} ghost onPress={() => go.back()} />
      <Title>{t('owner.reel')}</Title>
      <Field label={t('owner.tourName')} value={caption} onChangeText={setCaption} />
      <Field label={t('group.destination')} value={place} onChangeText={setPlace} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {['SUGHD', 'DUSHANBE', 'DRS', 'KHATLON', 'GBAO'].map((item) => (
          <Button key={item} label={region(item)} ghost={area !== item} onPress={() => setArea(item)} />
        ))}
      </View>
      <Button label={t('owner.icon')} ghost onPress={() => void pickAndUpload().then((url) => url && setPoster(url))} />
      <Button label={t('owner.video')} ghost onPress={() => void pickAndUpload('video').then((url) => url && setVideo(url))} />
      {error ? <Notice text={error} error /> : null}
      <Button label={t('common.save')} onPress={() => void save()} disabled={caption.trim().length < 3 || place.trim().length < 2 || !poster || !video} />
    </Frame>
  );
}
