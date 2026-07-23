import { View, Text, Image } from "@react-pdf/renderer";
import { styles } from "../styles";
import type { ActaData } from "../types";

export function SignatureSection({ data }: { data: ActaData }) {
  const t = data.dict.acta;
  return (
    <View style={[styles.section, styles.signatureBox]}>
      <Text style={styles.sectionTitle}>{t.signature}</Text>
      <Text style={styles.small}>{data.dict.signature.legal}</Text>
      {data.signatureDataUri ? (
        // eslint-disable-next-line jsx-a11y/alt-text
        <Image src={data.signatureDataUri} style={styles.signatureImg} />
      ) : null}
      {data.signerName ? <Text style={styles.value}>{data.signerName}</Text> : null}
      {data.registeredBy ? (
        <Text style={styles.small}>
          {t.registeredBy}: {data.registeredBy}
        </Text>
      ) : null}
    </View>
  );
}
