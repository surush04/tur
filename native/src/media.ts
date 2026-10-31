import * as ImagePicker from 'expo-image-picker';
import { uploadMedia } from './api';

export async function pickAndUpload(kind: 'image' | 'video' = 'image') {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('permission');
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: kind === 'video' ? ['videos'] : ['images'],
    quality: 0.85,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const name = asset.fileName ?? (kind === 'video' ? 'clip.mp4' : 'photo.jpg');
  const type = asset.mimeType ?? (kind === 'video' ? 'video/mp4' : 'image/jpeg');
  const uploaded = await uploadMedia({ uri: asset.uri, name, type });
  return uploaded.url;
}
