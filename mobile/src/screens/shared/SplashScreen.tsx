import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NMButton } from '../../components/ui/NMButton';
import { useTheme } from '../../theme/ThemeContext';
import { useAuthStore } from '../../store/authStore';
import type { Language } from '../../store/authStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SplashScreenProps {
  /** Called when user has picked a panel and wants to proceed to phone entry */
  onSelectPanel: (panel: 'buyer' | 'seller') => void;
}

// ── Strings ───────────────────────────────────────────────────────────────────

const strings: Record<Language, {
  tagline: string;
  buyerBtn: string;
  sellerBtn: string;
  or: string;
}> = {
  en: {
    tagline: 'Nirmal Stock. Nirmal Deals. Nirmal Execution.',
    buyerBtn: 'I am a Buyer',
    sellerBtn: 'I am a Seller',
    or: 'or',
  },
  hi: {
    tagline: 'निर्मल स्टॉक। निर्मल डील। निर्मल निष्पादन।',
    buyerBtn: 'मैं एक खरीदार हूँ',
    sellerBtn: 'मैं एक विक्रेता हूँ',
    or: 'या',
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function SplashScreen({ onSelectPanel }: SplashScreenProps) {
  const { tokens, colorMode, setPanel } = useTheme();
  const { language, setLanguage } = useAuthStore();

  const t = strings[language];

  function handleSelectBuyer() {
    setPanel('buyer');
    onSelectPanel('buyer');
  }

  function handleSelectSeller() {
    setPanel('seller');
    onSelectPanel('seller');
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: tokens.surface }]}
    >
      <StatusBar
        barStyle={colorMode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={tokens.surface}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Logo block ── */}
        <View style={styles.logoBlock}>
          {/* Logo mark — stylised N */}
          <View
            style={[
              styles.logoMark,
              { backgroundColor: tokens['primary-pale'] },
            ]}
          >
            <Text
              style={[styles.logoMarkText, { color: tokens.primary }]}
            >
              NM
            </Text>
          </View>

          {/* Brand name */}
          <Text style={[styles.brandName, { color: tokens['text-primary'] }]}>
            NirmalMandi
          </Text>

          {/* Tagline */}
          <Text style={[styles.tagline, { color: tokens['text-secondary'] }]}>
            {t.tagline}
          </Text>
        </View>

        {/* ── CTA buttons ── */}
        <View style={styles.ctaBlock}>
          {/* Buyer CTA */}
          <TouchableOpacity
            onPress={handleSelectBuyer}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t.buyerBtn}
            style={[
              styles.panelBtn,
              {
                backgroundColor: '#2563eb',
                borderRadius: tokens['btn-radius'],
              },
            ]}
          >
            <Text style={styles.panelBtnText}>{t.buyerBtn}</Text>
            <Text style={styles.panelBtnSub}>
              {language === 'hi' ? 'डील ब्राउज़ करें' : 'Browse deals near you'}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View
              style={[styles.dividerLine, { backgroundColor: tokens.border }]}
            />
            <Text style={[styles.dividerText, { color: tokens['text-muted'] }]}>
              {t.or}
            </Text>
            <View
              style={[styles.dividerLine, { backgroundColor: tokens.border }]}
            />
          </View>

          {/* Seller CTA */}
          <TouchableOpacity
            onPress={handleSelectSeller}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t.sellerBtn}
            style={[
              styles.panelBtn,
              {
                backgroundColor: '#16a34a',
                borderRadius: tokens['btn-radius'],
              },
            ]}
          >
            <Text style={styles.panelBtnText}>{t.sellerBtn}</Text>
            <Text style={styles.panelBtnSub}>
              {language === 'hi'
                ? 'डेड इन्वेंटरी लिस्ट करें'
                : 'List your dead inventory'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Language selector ── */}
        <View style={styles.langBlock}>
          <Text style={[styles.langLabel, { color: tokens['text-muted'] }]}>
            {language === 'hi' ? 'भाषा:' : 'Language:'}
          </Text>
          <View style={styles.langPills}>
            {(['en', 'hi'] as Language[]).map((lang) => {
              const active = language === lang;
              return (
                <TouchableOpacity
                  key={lang}
                  onPress={() => setLanguage(lang)}
                  style={[
                    styles.langPill,
                    {
                      backgroundColor: active
                        ? tokens.primary
                        : tokens['surface-elevated'],
                      borderColor: active ? tokens.primary : tokens.border,
                      borderRadius: tokens['btn-radius'],
                    },
                  ]}
                  accessibilityLabel={lang === 'en' ? 'English' : 'Hindi'}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text
                    style={[
                      styles.langPillText,
                      {
                        color: active ? '#ffffff' : tokens['text-secondary'],
                      },
                    ]}
                  >
                    {lang === 'en' ? 'EN' : 'हिन्दी'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
    justifyContent: 'space-between',
  },
  logoBlock: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoMark: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoMarkText: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
  },
  brandName: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  tagline: {
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  ctaBlock: {
    gap: 0,
    marginBottom: 40,
  },
  panelBtn: {
    minHeight: 56,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  panelBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  panelBtnSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
  },
  langBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  langLabel: {
    fontSize: 13,
  },
  langPills: {
    flexDirection: 'row',
    gap: 8,
  },
  langPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langPillText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
