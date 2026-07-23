import { View, Text } from "@react-pdf/renderer";
import { styles } from "../styles";
import type { ActaData } from "../types";

export function AuthorizedDriversSection({ data }: { data: ActaData }) {
  const t = data.dict.acta;
  if (!data.authorizedDrivers || data.authorizedDrivers.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t.authorizedDrivers}</Text>
      {data.authorizedDrivers.map((name, i) => (
        <Text key={i}>• {name}</Text>
      ))}
    </View>
  );
}
