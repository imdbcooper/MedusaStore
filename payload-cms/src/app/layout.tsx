export const metadata = {
  title: 'Payload CMS',
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{props.children}</body>
    </html>
  )
}
