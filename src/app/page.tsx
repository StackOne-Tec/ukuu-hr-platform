import "./landing.css"

import { Header, ThemeToggle } from "@/components/landing/Header"
import { Hero } from "@/components/landing/Hero"
import {
  Features,
  Metrics,
  Workflow,
  Testimonials,
} from "@/components/landing/Sections1"
import { Download, Deploy } from "@/components/landing/Sections2"
import {
  Stats,
  Compare,
  Faq,
  Founders,
  Cta,
  Footer,
} from "@/components/landing/Sections3"

export default function Home() {
  return (
    <div className="lp-root">
      <Header />
      <ThemeToggle />
      <main>
        <Hero />
        <Features />
        <Metrics />
        <Workflow />
        <Testimonials />
        <Download />
        <Deploy />
        <Stats />
        <Compare />
        <Faq />
        <Founders />
        <Cta />
      </main>
      <Footer />
    </div>
  )
}
