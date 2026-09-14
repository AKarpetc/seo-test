import { DATASETS } from '@/lib/datasets';
import { ComingSoon, pendingMetadata } from '@/components/ComingSoon';

const config = DATASETS.trademark;

export const metadata = pendingMetadata(config);

export default function Index() {
  return <ComingSoon config={config} />;
}
