import { View, Text } from "@react-pdf/renderer";
import { styles } from "../styles";
import type { ContractText } from "@/lib/contract-text";

/** Condiciones generales: la versión del contrato que firmó esta inspección. */
export function LegalSection({ contract }: { contract: ContractText }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{contract.title}</Text>
      {contract.paragraphs.map((p, i) => (
        <Text key={i} style={styles.legalP}>
          {p}
        </Text>
      ))}
    </View>
  );
}
