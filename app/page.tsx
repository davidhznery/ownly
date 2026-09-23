'use client';

import { useEffect, useState } from 'react';
import Brand,{BrandMark} from './components/Brand';

const Arrow = () => <span aria-hidden="true">→</span>;

function DashboardPreview() {
  return (
    <div className="dashboard-shell" aria-label="Ownly property dashboard preview">
      <div className="preview-sidebar">
        <div className="preview-mark"><BrandMark /></div>
        <div className="preview-nav active">Overview</div>
        <div className="preview-nav">Properties</div>
        <div className="preview-nav">Projections</div>
      </div>
      <div className="preview-main">
        <div className="preview-topline">
          <div><span className="eyebrow">PROPERTY OVERVIEW</span><h3>Sliema Seafront Apartment</h3></div>
          <span className="status"><i /> Performing well</span>
        </div>
        <div className="aha-card"><span>ESTIMATED NET CASH FLOW</span><strong>€1,284</strong><small>per month</small><div className="trend">↗ €146 vs. last month</div></div>
        <div className="metric-row"><div><span>Monthly revenue</span><b>€3,850</b></div><div><span>Operating costs</span><b>€1,126</b></div><div><span>Mortgage</span><b>€1,440</b></div></div>
        <div className="mini-chart"><div className="chart-heading"><b>Cash flow</b><span>Last 6 months</span></div><div className="bars">{[54,62,58,74,70,88].map((height,index)=><i key={index} style={{height:`${height}%`}} />)}</div><div className="months"><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span></div></div>
      </div>
    </div>
  );
}

const faqs = [
  ['Do I need accounting knowledge?','Not at all. Ownly translates your property numbers into plain language and highlights what matters most.'],
  ['Does it work for both Airbnb and long lets?','Yes. Choose your rental strategy and Ownly adapts the income fields and calculations automatically.'],
  ['Can I track more than one property?','Yes. The Portfolio plan brings every property together with combined value, debt, equity and cash flow.'],
  ['Are projections guaranteed?','No. Projections are estimates based on assumptions you control, and are always labelled clearly as such.'],
  ['Is my data secure?','Your account is protected by secure sign-in, and property records are isolated to your account. We collect only what the product needs.'],
];

export default function Home() {
  const [menuOpen,setMenuOpen]=useState(false);
  const [openFaq,setOpenFaq]=useState(0);
  const [videoOpen,setVideoOpen]=useState(false);

  useEffect(()=>{
    if(!videoOpen) return;
    const previousOverflow=document.body.style.overflow;
    const closeOnEscape=(event:KeyboardEvent)=>{ if(event.key==='Escape') setVideoOpen(false); };
    document.body.style.overflow='hidden';
    window.addEventListener('keydown',closeOnEscape);
    return ()=>{
      document.body.style.overflow=previousOverflow;
      window.removeEventListener('keydown',closeOnEscape);
    };
  },[videoOpen]);

  return (
    <main>
      <nav className="nav wrap">
        <Brand href="#top" />
        <button className="menu" onClick={()=>setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label="Toggle navigation">Menu</button>
        <div className={`nav-links ${menuOpen?'open':''}`}><a href="#product">Product</a><a href="#how">How it works</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a><a className="login" href="/signin-with-chatgpt?return_to=%2Fdashboard">Log in</a><a className="button small" href="/signin-with-chatgpt?return_to=%2Fdashboard">Start free trial <Arrow /></a></div>
      </nav>
      <section className="hero wrap" id="top">
        <div className="hero-copy"><div className="pill"><i /> For property owners and subletters in Malta</div><h1>Know what your property is <em>really</em> earning.</h1><p>Track income, expenses, mortgages, cash flow and long-term returns in one clear dashboard.</p><div className="hero-actions"><a className="button" href="/signin-with-chatgpt?return_to=%2Fdashboard">Start free trial <Arrow /></a><button className="text-link video-trigger" type="button" onClick={()=>setVideoOpen(true)}><span>▶</span> See how it works</button></div><small className="reassurance">7-day free trial · No credit card required · Set up in under 5 minutes</small></div>
        <div className="hero-visual"><DashboardPreview /></div>
      </section>
      <section className="trust-strip"><div className="wrap"><span>One simple view for</span><b>Airbnb hosts</b><b>Long-term landlords</b><b>Property investors</b><b>Small portfolios</b></div></section>
      <section className="section center" id="product"><div className="section-head"><span className="kicker">THE NUMBERS THAT MATTER</span><h2>From scattered costs to one clear answer.</h2><p>Stop wondering whether rent covers the full cost of your rental. See the whole picture without spreadsheets.</p></div><div className="benefit-grid wrap">
        <article><div className="feature-icon">€</div><h3>True monthly cash flow</h3><p>Combine rental income, recurring costs, rent paid and your mortgage to see what remains each month.</p><span>Income − costs − debt</span></article>
        <article><div className="feature-icon">%</div><h3>Returns you can understand</h3><p>See profit margin, ROI and cash-on-cash return only when the right information is available.</p><span>No finance degree needed</span></article>
        <article><div className="feature-icon">↗</div><h3>Plan years ahead</h3><p>Model rent growth, expense inflation, appreciation and mortgage amortisation over time.</p><span>1, 5, 10 and 20 years</span></article>
      </div></section>
      <section className="how-section" id="how"><div className="wrap how-grid"><div className="how-copy"><span className="kicker">UP AND RUNNING IN MINUTES</span><h2>Your first clear answer in three steps.</h2><p>Ownly guides you through the essentials. Add only what you know—you can refine the details later.</p><a className="button" href="/signin-with-chatgpt?return_to=%2Fdashboard">Add your first property <Arrow /></a></div><div className="steps">
        <article><b>01</b><div><h3>Add your property</h3><p>Own it or sublet it? Add your property and rental strategy.</p></div></article><article><b>02</b><div><h3>Enter income and costs</h3><p>Use quick estimates or actual monthly figures.</p></div></article><article><b>03</b><div><h3>See your real cash flow</h3><p>Get an immediate, plain-English profitability view.</p></div></article>
      </div></div></section>
      <section className="section insight-section"><div className="wrap insight-grid"><div className="insight-card"><span>YOUR MONTHLY INSIGHT</span><div className="insight-number">€1,284</div><p>positive net cash flow</p><hr/><div className="insight-stats"><div><b>33.4%</b><span>Profit margin</span></div><div><b>6.8%</b><span>Cash-on-cash</span></div><div><b>€183k</b><span>Est. equity</span></div></div></div><div className="insight-copy"><span className="kicker">CLARITY AT A GLANCE</span><h2>Know what is working—and what is costing you.</h2><p>Ownly turns a long list of transactions into a calm, decision-ready view of each property and your portfolio as a whole.</p><ul><li><i>✓</i> Separate operating costs from mortgage payments</li><li><i>✓</i> Compare actuals with your original estimates</li><li><i>✓</i> Track debt, equity and total return over time</li></ul></div></div></section>
      <section className="section pricing-section" id="pricing"><div className="section-head"><span className="kicker">SIMPLE PRICING</span><h2>Start free. Upgrade when it proves useful.</h2><p>Every plan includes a 7-day free trial. No card required to explore.</p></div><div className="pricing-grid wrap">
        <article><span className="plan">INDIVIDUAL</span><h3>€9<span>/month</span></h3><p>For owners and subletters managing one to three properties.</p><ul><li>Up to 3 properties</li><li>Income and expense tracking</li><li>Cash-flow dashboard</li><li>Long-term projections</li></ul><a className="outline-button" href="/signin-with-chatgpt?return_to=%2Fdashboard">Start free trial</a></article>
        <article className="popular"><div className="popular-label">MOST POPULAR</div><span className="plan">PORTFOLIO</span><h3>€19<span>/month</span></h3><p>For investors and managers with a growing portfolio.</p><ul><li>Up to 15 properties</li><li>Everything in Individual</li><li>Portfolio-level dashboard</li><li>Priority support</li></ul><a className="button" href="/signin-with-chatgpt?return_to=%2Fdashboard">Start free trial <Arrow /></a></article>
        <article><span className="plan">MARKET PRO</span><h3>€39<span>/month</span></h3><p>For owners and subletters comparing local rental prices.</p><ul><li>Everything in Portfolio</li><li>Optional local rental price estimates</li><li>Local comparable-property analysis</li><li>Source and date shown for every insight</li></ul><a className="outline-button" href="mailto:hello@clearyield.app?subject=Ownly%20Market%20Pro">Join the waitlist</a></article>
      </div><p className="pricing-note">Prices include VAT where applicable. Cancel anytime.</p></section>
      <section className="section faq-section" id="faq"><div className="wrap faq-grid"><div><span className="kicker">QUESTIONS, ANSWERED</span><h2>Everything you need to get started.</h2><p>Still unsure? <a href="mailto:hello@clearyield.app">Talk to us</a> and we’ll help.</p></div><div className="faq-list">{faqs.map(([q,a],i)=><article key={q} className={openFaq===i?'open':''}><button onClick={()=>setOpenFaq(openFaq===i?-1:i)} aria-expanded={openFaq===i}><span>{q}</span><b>{openFaq===i?'−':'+'}</b></button>{openFaq===i&&<p>{a}</p>}</article>)}</div></div></section>
      <section className="cta-section"><div className="wrap"><span className="kicker light">YOUR PROPERTY. ONE CLEAR ANSWER.</span><h2>Find out what your property is really earning.</h2><p>Create your first property and see your estimated net cash flow in under five minutes.</p><a className="button light-button" href="/signin-with-chatgpt?return_to=%2Fdashboard">Start your free trial <Arrow /></a></div></section>
      <footer><div className="wrap footer-main"><div><Brand href="#top" /><p>Property performance, made clear.</p></div><div><b>Product</b><a href="#product">Features</a><a href="#pricing">Pricing</a><a href="/signin-with-chatgpt?return_to=%2Fdashboard">Log in</a></div><div><b>Company</b><a href="mailto:hello@clearyield.app">Contact</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div></div><div className="wrap footer-bottom"><span>© 2026 Ownly. All rights reserved.</span><span>Made for property owners and subletters in Malta 🇲🇹</span></div></footer>
      {videoOpen&&<div className="video-modal" role="dialog" aria-modal="true" aria-labelledby="how-it-works-title" onMouseDown={(event)=>{if(event.target===event.currentTarget)setVideoOpen(false)}}>
        <div className="video-modal-panel">
          <div className="video-modal-head"><div><span>OWNLY IN 24 SECONDS</span><h2 id="how-it-works-title">See how it works</h2></div><button type="button" onClick={()=>setVideoOpen(false)} aria-label="Close video">×</button></div>
          <video src="/ownly-how-it-works.mp4" controls autoPlay playsInline preload="metadata">Your browser does not support the video element.</video>
        </div>
      </div>}
    </main>
  );
}
