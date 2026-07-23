import { View, Text } from "@react-pdf/renderer";
import { styles } from "../styles";
import type { Dictionary } from "@/lib/i18n";

export function LegalSection({ dict }: { dict: Dictionary }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{dict.legal.title}</Text>
      {dict.legal.paragraphs.map((p, i) => (
        <Text key={i} style={styles.legalP}>
          {p}
        </Text>
      ))}
      <Text style={styles.legalP}>{dict.legal.photoConsent}</Text>
      <Text style={styles.legalP}>{dict.legal.jurisdiction}</Text>
      <Text style={styles.legalP}>{dict.legal.acceptance}</Text>
    </View>
  );
}
