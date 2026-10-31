import { useNavigation } from '@react-navigation/native';
import { useMemo } from 'react';

export type ReturnTarget = { name: string; params?: object };

export function useGo() {
  const navigation = useNavigation();
  return useMemo(() => {
    const nav = navigation as unknown as {
      navigate: (name: string, params?: object) => void;
      replace: (name: string, params?: object) => void;
      goBack: () => void;
      canGoBack: () => boolean;
    };
    return {
      go(name: string, params?: object) {
        nav.navigate(name, params);
      },
      replace(name: string, params?: object) {
        nav.replace(name, params);
      },
      back() {
        if (nav.canGoBack()) nav.goBack();
        else nav.navigate('Main');
      },
    };
  }, [navigation]);
}
