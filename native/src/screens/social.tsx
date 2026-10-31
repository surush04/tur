import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useRoute } from '@react-navigation/native';
import * as api from '../api';
import { ApiError, type GroupCard, type GroupDetail, type GroupMessage, type Reel } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { mediaUrl } from '../config';
import { pickAndUpload } from '../media';
import { useGo } from '../nav';
import { colors } from '../theme';
import { Button, Card, Field, Frame, Loading, Muted, Notice, Photo, Title } from '../ui';

function Clip({ url }: { url: string }) {
  const player = useVideoPlayer(mediaUrl(url) ?? url, (item) => {
    item.loop = true;
  });
  return <VideoView player={player} style={{ height: 360, borderRadius: 16, backgroundColor: '#111' }} contentFit="cover" nativeControls />;
}

export function ReelsScreen() {
  const { t, region } = useI18n();
  const { user } = useAuth();
  const go = useGo();
  const [rows, setRows] = useState<Reel[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState('');
  const load = () => {
    void api.reels().then(setRows).catch(() => setError(t('common.offline')));
  };
  useEffect(load, [t]);
  const act = async (id: string, kind: 'like' | 'save') => {
    if (!user) {
      go.go('Register', { returnTo: { name: 'Main', params: { screen: 'Reels' } } });
      return;
    }
    try {
      if (kind === 'like') {
        const result = await api.likeReel(id);
        setRows((list) => list.map((item) => item.id === id ? { ...item, liked: result.liked, likes: result.count } : item));
      } else {
        const result = await api.saveReel(id);
        setRows((list) => list.map((item) => item.id === id ? { ...item, saved: result.saved } : item));
      }
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('common.offline'));
    }
  };
  return (
    <Frame>
      <Title>{t('tabs.reels')}</Title>
      {error ? <Notice text={error} error /> : null}
      {rows.map((item) => (
        <View key={item.id} style={{ gap: 8, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 10 }}>
          {open === item.id ? <Clip url={item.videoUrl} /> : <Pressable onPress={() => setOpen(item.id)}><Photo url={item.posterUrl} height={220} /></Pressable>}
          <Text style={{ fontWeight: '700', color: colors.text }}>{item.caption}</Text>
          <Muted>{item.creator} · {item.destinationName} · {region(item.region)}</Muted>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Pressable onPress={() => void act(item.id, 'like')} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name={item.liked ? 'heart' : 'heart-outline'} size={22} color={colors.primary} />
              <Text>{item.likes}</Text>
            </Pressable>
            <Pressable onPress={() => void act(item.id, 'save')} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Ionicons name={item.saved ? 'bookmark' : 'bookmark-outline'} size={22} color={colors.primary} />
            </Pressable>
          </View>
          {item.tourSlug ? <Button label={item.tourTitle || t('tour.view')} ghost onPress={() => go.go('Tour', { slug: item.tourSlug as string })} /> : null}
        </View>
      ))}
      {!rows.length && !error ? <Loading /> : null}
    </Frame>
  );
}

export function GroupsScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const go = useGo();
  const [rows, setRows] = useState<GroupCard[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!user) return;
    void api.groups().then(setRows).catch(() => setError(t('common.offline')));
  }, [user, t]);
  if (!user) {
    return (
      <Frame>
        <Title>{t('tabs.groups')}</Title>
        <Muted>{t('gate.number')}</Muted>
        <Button label={t('common.account')} onPress={() => go.go('Register', { returnTo: { name: 'Main', params: { screen: 'Groups' } } })} />
      </Frame>
    );
  }
  return (
    <Frame>
      <Title>{t('tabs.groups')}</Title>
      <Button label={t('group.create')} onPress={() => go.go('GroupNew')} />
      {error ? <Notice text={error} error /> : null}
      {rows.map((item) => (
        <Card key={item.id} title={item.name} subtitle={`${item.destinationName} · ${item.memberCount}/${item.desiredSize}`} image={item.coverImageUrl} onPress={() => go.go('Group', { id: item.id })} />
      ))}
    </Frame>
  );
}

export function GroupNewScreen() {
  const { t, region } = useI18n();
  const go = useGo();
  const [name, setName] = useState('');
  const [destinationName, setDestination] = useState('');
  const [area, setArea] = useState('SUGHD');
  const [description, setDescription] = useState('');
  const [size, setSize] = useState('4');
  const [budget, setBudget] = useState('');
  const [cover, setCover] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const created = await api.createGroup({
        name: name.trim(),
        destinationName: destinationName.trim(),
        region: area,
        description: description.trim(),
        flexibleDates: true,
        desiredSize: Number(size) || 4,
        visibility: 'PUBLIC',
        joinMode: 'REQUEST',
        ...(budget ? { budgetPerPerson: budget } : {}),
        ...(cover ? { coverImageUrl: cover } : {}),
      });
      go.replace('Group', { id: created.id });
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('common.offline'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Frame>
      <Button label={t('common.back')} ghost onPress={() => go.back()} />
      <Title>{t('group.create')}</Title>
      <Field label={t('group.name')} value={name} onChangeText={setName} />
      <Field label={t('group.destination')} value={destinationName} onChangeText={setDestination} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {['SUGHD', 'DUSHANBE', 'DRS', 'KHATLON', 'GBAO'].map((item) => (
          <Button key={item} label={region(item)} ghost={area !== item} onPress={() => setArea(item)} />
        ))}
      </View>
      <Field label={t('group.about')} value={description} onChangeText={setDescription} multiline />
      <Field label={t('group.size')} value={size} onChangeText={setSize} keyboard="number-pad" />
      <Field label={t('group.budget')} value={budget} onChangeText={setBudget} keyboard="decimal-pad" />
      <Button label={t('group.cover')} ghost onPress={() => void pickAndUpload().then((url) => url && setCover(url)).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Error'))} />
      {cover ? <Photo url={cover} height={120} /> : null}
      {error ? <Notice text={error} error /> : null}
      <Button label={t('group.create')} onPress={() => void save()} disabled={busy || name.trim().length < 3 || destinationName.trim().length < 2 || description.trim().length < 10} />
    </Frame>
  );
}

export function GroupScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const go = useGo();
  const id = (useRoute().params as { id: string }).id;
  const [item, setItem] = useState<GroupDetail | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const load = () => {
    if (!user) return;
    void api.group(id).then(setItem).catch(() => setError(t('common.offline')));
    void api.groupMessages(id).then((page) => setMessages(page.messages)).catch(() => undefined);
  };
  useEffect(load, [id, user, t]);
  if (!user) {
    return (
      <Frame>
        <Muted>{t('gate.number')}</Muted>
        <Button label={t('common.account')} onPress={() => go.go('Register', { returnTo: { name: 'Group', params: { id } } })} />
      </Frame>
    );
  }
  const send = async () => {
    if (!text.trim()) return;
    await api.sendGroupMessage(id, text.trim());
    setText('');
    load();
  };
  return (
    <Frame>
      <Button label={t('common.back')} ghost onPress={() => go.back()} />
      {error ? <Notice text={error} error /> : null}
      {item ? (
        <>
          <Card title={item.name} subtitle={`${item.destinationName} · ${item.memberCount}/${item.desiredSize}`} image={item.coverImageUrl} />
          <Muted>{item.description}</Muted>
          {!item.isMember ? <Button label={t('group.join')} onPress={() => void api.joinGroup(id).then(load).catch((reason: unknown) => setError(reason instanceof ApiError ? reason.message : t('common.offline')))} /> : null}
          <Title>{t('group.chat')}</Title>
          {messages.map((message) => (
            <Muted key={message.id}>{`${message.sender?.firstName || ''}: ${message.body}`}</Muted>
          ))}
          {item.isMember ? (
            <>
              <Field label={t('group.chat')} value={text} onChangeText={setText} />
              <Button label={t('common.save')} onPress={() => void send()} />
            </>
          ) : null}
        </>
      ) : <Loading />}
    </Frame>
  );
}

export function MessagesScreen() {
  const { t } = useI18n();
  const go = useGo();
  const [rows, setRows] = useState<{ id: string; preview: string; with: string[] }[]>([]);
  useEffect(() => {
    void api.conversations().then(setRows).catch(() => setRows([]));
  }, []);
  return (
    <Frame>
      <Button label={t('common.back')} ghost onPress={() => go.back()} />
      <Title>{t('profile.messages')}</Title>
      {rows.map((item) => (
        <Card key={item.id} title={item.with.join(', ') || t('profile.messages')} subtitle={item.preview} onPress={() => go.go('Conversation', { id: item.id })} />
      ))}
    </Frame>
  );
}

export function ConversationScreen() {
  const { t } = useI18n();
  const go = useGo();
  const id = (useRoute().params as { id: string }).id;
  const [rows, setRows] = useState<{ id: string; body: string; mine: boolean; sender: string }[]>([]);
  const [text, setText] = useState('');
  const load = () => {
    void api.conversation(id).then((item) => setRows(item.messages)).catch(() => setRows([]));
  };
  useEffect(load, [id]);
  return (
    <Frame>
      <Button label={t('common.back')} ghost onPress={() => go.back()} />
      {rows.map((item) => <Muted key={item.id}>{`${item.sender}: ${item.body}`}</Muted>)}
      <Field label={t('profile.messages')} value={text} onChangeText={setText} />
      <Button label={t('common.save')} onPress={() => void api.sendDirect(id, text.trim()).then(() => { setText(''); load(); })} disabled={!text.trim()} />
    </Frame>
  );
}
