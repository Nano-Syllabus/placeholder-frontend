import { Navbar } from "@/components/navbar";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, MessageSquare, LayoutDashboard, Shield, Users, ArrowRight, BookOpen } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="container mx-auto px-4 pt-24 pb-32 md:pt-32 md:pb-40">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col gap-6"
            >
              <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground w-fit">
                New: Real-time collaborative annotations
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground">
                Learn Together. <br className="hidden md:block" />
                <span className="text-primary">Discuss Inside Every Document.</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-[600px]">
                Teachers upload course materials. Students collaborate, annotate, and discuss directly inside PDFs via threaded conversations. The modern way to learn.
              </p>
              <div className="flex flex-wrap gap-4 pt-4">
                <Link href="/viewer" className="inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8 text-base shadow-sm">
                  Get Started <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link href="/dashboard" className="inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-11 px-8 text-base shadow-sm">
                  Watch Demo
                </Link>
              </div>
            </motion.div>
            
            {/* UI Mockup Illustration */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="relative mx-auto w-full max-w-[600px]"
            >
              <div className="relative rounded-xl border bg-card shadow-2xl overflow-hidden aspect-[4/3] flex flex-col">
                <div className="h-10 border-b flex items-center px-4 gap-2 bg-muted/50">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="mx-auto bg-background border rounded-md h-6 w-1/2 flex items-center justify-center text-xs text-muted-foreground">
                    collablearn.app/viewer
                  </div>
                </div>
                <div className="flex flex-1 overflow-hidden">
                  <div className="w-1/4 border-r bg-muted/20 p-4 flex flex-col gap-3">
                    <div className="h-4 bg-muted rounded w-1/2" />
                    <div className="h-2 bg-muted rounded w-full" />
                    <div className="h-2 bg-muted rounded w-3/4" />
                    <div className="h-2 bg-muted rounded w-5/6" />
                    <div className="h-2 bg-primary/20 rounded w-full mt-4" />
                  </div>
                  <div className="flex-1 p-6 relative flex items-center justify-center bg-muted/10">
                    <div className="w-3/4 h-5/6 bg-background border shadow-sm rounded flex flex-col p-4 gap-4">
                      <div className="h-6 bg-muted rounded w-1/3 mx-auto" />
                      <div className="h-2 bg-muted rounded w-full" />
                      <div className="h-2 bg-muted rounded w-full" />
                      <div className="h-2 bg-muted rounded w-5/6" />
                      <div className="h-2 bg-muted rounded w-full mt-4" />
                      <div className="h-2 bg-muted rounded w-4/5" />
                    </div>
                    {/* Floating Pins */}
                    <div className="absolute top-1/3 left-1/2 w-6 h-6 bg-primary rounded-full border-2 border-background text-[10px] text-primary-foreground flex items-center justify-center font-bold shadow-md transform -translate-x-1/2 -translate-y-1/2">
                      1
                    </div>
                    <div className="absolute bottom-1/3 right-1/3 w-6 h-6 bg-primary rounded-full border-2 border-background text-[10px] text-primary-foreground flex items-center justify-center font-bold shadow-md">
                      2
                    </div>
                  </div>
                  <div className="w-1/3 border-l bg-card p-4 flex flex-col gap-4">
                    <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                    <div className="border rounded-md p-3 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/20" />
                        <div className="h-3 bg-muted rounded w-20" />
                      </div>
                      <div className="h-2 bg-muted rounded w-full" />
                      <div className="h-2 bg-muted rounded w-4/5" />
                    </div>
                    <div className="border rounded-md p-3 flex flex-col gap-2 opacity-50">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/20" />
                        <div className="h-3 bg-muted rounded w-16" />
                      </div>
                      <div className="h-2 bg-muted rounded w-full" />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Decorative elements */}
              <div className="absolute -z-10 top-1/2 -right-12 w-64 h-64 bg-primary/20 blur-3xl rounded-full" />
              <div className="absolute -z-10 -bottom-12 -left-12 w-48 h-48 bg-blue-500/10 blur-3xl rounded-full" />
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section className="bg-muted/30 py-24">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl font-bold tracking-tight mb-4">Everything you need to teach and learn</h2>
              <p className="text-muted-foreground text-lg">A comprehensive suite of tools designed to make collaborative learning seamless and effective.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: FileText, title: "Upload PDFs", desc: "Easily upload course materials and instantly share them with your students in organized spaces." },
                { icon: BookOpen, title: "Interactive PDF Viewer", desc: "Read and navigate documents comfortably with our custom-built, fast PDF rendering engine." },
                { icon: MessageSquare, title: "Threaded Discussions", desc: "Drop a pin anywhere on a page to start a contextual discussion thread that anyone can join." },
                { icon: LayoutDashboard, title: "Teacher Dashboard", desc: "Track student engagement, view analytics, and manage your courses from a powerful command center." },
                { icon: Shield, title: "Secure Course Access", desc: "Keep your materials safe with granular access controls and student enrollment management." },
                { icon: Users, title: "Real-Time Collaboration", desc: "See typing indicators and new replies instantly without having to refresh the page." }
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card className="h-full transition-all hover:shadow-md hover:border-primary/50 group">
                    <CardContent className="p-6 flex flex-col gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <feature.icon className="h-6 w-6" />
                      </div>
                      <h3 className="text-xl font-semibold">{feature.title}</h3>
                      <p className="text-muted-foreground">{feature.desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-24">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl font-bold tracking-tight mb-4">How it works</h2>
              <p className="text-muted-foreground text-lg">From uploading materials to answering student questions, the workflow is intuitive.</p>
            </div>
            
            <div className="relative max-w-4xl mx-auto">
              {/* Vertical line */}
              <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-border hidden md:block" />
              
              <div className="flex flex-col gap-12">
                {[
                  { step: "1", title: "Teacher uploads PDF", desc: "Drag and drop course materials into a secure course workspace." },
                  { step: "2", title: "Students open document", desc: "Students are notified and can access the material from any device." },
                  { step: "3", title: "Create discussion threads", desc: "Highlight text or click anywhere to ask a question or leave a note." },
                  { step: "4", title: "Reply in real time", desc: "Peers and teachers can jump into the thread to provide answers." },
                  { step: "5", title: "Teacher answers questions", desc: "Instructors can easily spot unresolved questions from their dashboard." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-6 items-start relative z-10">
                    <div className="w-16 h-16 rounded-full bg-card border-2 border-primary flex items-center justify-center text-xl font-bold text-primary shrink-0 shadow-sm">
                      {item.step}
                    </div>
                    <div className="pt-3">
                      <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                      <p className="text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Statistics */}
        <section className="bg-primary text-primary-foreground py-20">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { value: "250+", label: "Courses" },
                { value: "12K+", label: "Students" },
                { value: "2,500+", label: "Resources" },
                { value: "15K+", label: "Discussions" }
              ].map((stat, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="text-4xl md:text-5xl font-bold tracking-tight">{stat.value}</div>
                  <div className="text-primary-foreground/80 font-medium">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card py-12">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">CollabLearn</span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">About</Link>
            <Link href="/" className="hover:text-foreground transition-colors">Features</Link>
            <Link href="/" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/" className="hover:text-foreground transition-colors">Contact</Link>
          </div>
          <div className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} CollabLearn. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
