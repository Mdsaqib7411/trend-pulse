import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  keywords: string[];
  onKeywordPress: (kw: string) => void;
}

export default function KeywordCloud({ keywords, onKeywordPress }: Props) {
  if (!keywords || keywords.length === 0) return null;

  return (
    <View style={styles.container}>
      {keywords.map((kw, i) => (
        <TouchableOpacity key={i} style={styles.chip} onPress={() => onKeywordPress(kw)} activeOpacity={0.7}>
          <Text style={styles.text}>#{kw}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  chip: {
    backgroundColor: 'rgba(106,37,244,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(106,37,244,0.3)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  text: {
    color: '#d8b4fe',
    fontSize: 12,
    fontWeight: '600',
  }
});
