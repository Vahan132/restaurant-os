import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors } from '@/theme/theme';

/**
 * Centered "sign in to continue" prompt shown on the Reservations / Saved tabs when the
 * user is anonymous. Tapping the button opens the login sheet.
 */
export function SignInPrompt({ message }: { message: string }) {
  const router = useRouter();
  const { t } = useTranslation('common');
  return (
    <View className="flex-1 items-center justify-center px-8">
      <Ionicons name="person-circle-outline" size={48} color={colors.textFaint} />
      <Text className="mt-4 text-center text-base text-textMuted">{message}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/login')}
        className="mt-6 rounded-xl bg-accent px-6 py-3 active:opacity-80"
      >
        <Text className="font-semibold text-accentText">{t('auth.signIn')}</Text>
      </Pressable>
    </View>
  );
}
