import { View, Text } from "@react-pdf/renderer";
import { styles } from "../styles";
import type { ActaData } from "../types";

export function ChecklistSection({ data }: { data: ActaData }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Checklist</Text>
      <View style={styles.checklistWrap}>
        {data.checklist.map((c, i) => (
          <View style={styles.li} key={i}>
            <Text>{c.label}</Text>
            <Text style={c.status === "ok" ? styles.ok : styles.fail}>
              {c.status === "ok" ? "OK" : "✗"}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
