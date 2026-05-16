import { redirect } from 'next/navigation'

// /packing is the new label; the implementation still lives at /boxes.
export default function PackingPage() {
  redirect('/boxes')
}
