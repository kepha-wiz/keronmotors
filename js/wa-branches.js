(function () {
	// Branch phone numbers (international format, no +). Jinja and Mbiko combined.
	const BRANCHES = [
		{ id: 'jinja-mbiko', label: 'Jinja Branch', phone: '256706507280' }, // provided
		{ id: 'masaka', label: 'Masaka Branch', phone: '256783170177' },             // updated
		{ id: 'mbarara', label: 'Mbarara Branch', phone: '256783170177' }            // updated
	];

	// store elements we disable so we can restore later
	let disabledOverlays = [];

	// Find likely external widget elements (iframes/scripts with known src, 3p classes, or extremely high z-index)
	function findExternalWidgetNodes() {
		const nodes = new Set();

		// iframes / scripts with known 3rd-party host strings
		document.querySelectorAll('iframe[src], script[src]').forEach(n => {
			try {
				const src = (n.getAttribute('src') || '').toLowerCase();
				if (src.includes('delightchat') || src.includes('d2mpatx')) nodes.add(n);
			} catch (e) {}
		});

		// elements with class names that likely belong to widget (avoid matching our modal)
		document.querySelectorAll('[class]').forEach(n => {
			try {
				if (n.closest && n.closest('.wa-branches-modal')) return; // skip modal internals
				const cls = (n.className || '').toString().toLowerCase();
				if (cls.includes('delight') || cls.includes('whatsapp') || cls.includes('dc-widget') ) nodes.add(n);
			} catch(e){}
		});

		// elements with extremely large z-index (likely overlays)
		document.querySelectorAll('body *').forEach(n => {
			try {
				if (n.closest && n.closest('.wa-branches-modal')) return;
				const z = window.getComputedStyle(n).zIndex;
				if (z && !isNaN(Number(z)) && Number(z) >= 900000) nodes.add(n);
			} catch(e){}
		});

		return Array.from(nodes);
	}

	function disableExternalOverlays() {
		disabledOverlays = [];
		const nodes = findExternalWidgetNodes();
		nodes.forEach(n => {
			try {
				// store old pointer-events to restore
				const old = n.style.pointerEvents || '';
				disabledOverlays.push({ node: n, old });
				n.style.pointerEvents = 'none';
			} catch(e){}
		});
	}

	function restoreExternalOverlays() {
		disabledOverlays.forEach(entry => {
			try {
				entry.node.style.pointerEvents = entry.old || '';
			} catch(e){}
		});
		disabledOverlays = [];
	}

	/* ---------- UI creation ---------- */
	function createFab () {
		if (document.querySelector('.wa-fab')) return;
		const fab = document.createElement('button');
		fab.className = 'wa-fab';
		fab.setAttribute('aria-label', 'WhatsApp');
		fab.innerHTML = '<i class="fab fa-whatsapp" style="font-size:1.4rem"></i>';
		document.body.appendChild(fab);
		fab.addEventListener('click', function(e){ e.preventDefault(); openModal(); });
	}

	function createModal () {
		if (document.querySelector('.wa-branches-modal')) return;
		const modal = document.createElement('div');
		modal.className = 'wa-branches-modal';
		modal.innerHTML = `
			<div class="wa-branches-panel" role="dialog" aria-modal="true" aria-label="Select branch">
				<h4>Contact Keron Motors</h4>
				<p style="margin:0 0 .6rem 0; color:#475569">Choose a branch to message on WhatsApp</p>
				<div class="wa-branches-list">
					${BRANCHES.map(b => `
						<button class="wa-branch-btn" data-phone="${b.phone}" data-id="${b.id}" type="button">
							<span class="name">${b.label}</span>
							<span class="phone">${formatLocal(b.phone)}</span>
						</button>
					`).join('')}
				</div>
				<div class="wa-branches-actions">
					<button class="wa-branches-close" type="button">Close</button>
				</div>
			</div>
		`;
		document.body.appendChild(modal);

		// Delegated click for branch buttons and close button (single handler)
		modal.addEventListener('click', function (e) {
			// Branch button
			const branchBtn = e.target.closest('.wa-branch-btn');
			if (branchBtn) {
				const phone = branchBtn.getAttribute('data-phone');
				openWhatsApp(phone);
				return;
			}
			// Close button
			const closeBtn = e.target.closest('.wa-branches-close');
			if (closeBtn) {
				closeModal();
				return;
			}
			// Backdrop click
			if (e.target === modal) closeModal();
		});
	}

	function formatLocal(phone) {
		if (!phone) return '';
		if (phone.startsWith('256') && phone.length >= 9) {
			const rest = phone.slice(3);
			if (rest.startsWith('7')) return '0' + rest;
		}
		return phone;
	}

	/* ---------- Modal control (disable overlays while modal open) ---------- */
	function openModal () {
		const modal = document.querySelector('.wa-branches-modal');
		if (modal) {
			// disable interfering overlays before showing modal
			disableExternalOverlays();
			modal.classList.add('show');
			// trap focus optionally
			const firstBtn = modal.querySelector('.wa-branch-btn, .wa-branches-close');
			if (firstBtn) firstBtn.focus();
		}
	}
	function closeModal () {
		const modal = document.querySelector('.wa-branches-modal');
		if (modal) {
			modal.classList.remove('show');
			// restore overlays after hide
			restoreExternalOverlays();
		}
	}

	/* ---------- Open WhatsApp ---------- */
	function openWhatsApp (phone) {
		const message = encodeURIComponent('Hello Keron Motors, I want to enquire about your Tuk Tuks / parts.');
		const url = `https://wa.me/${phone}?text=${message}`;
		window.open(url, '_blank');
		// optionally close modal after opening
		closeModal();
	}

	/* ---------- External widget interception ---------- */
	function attachInterceptToElement(el) {
		if (!el || el.__waInterceptAttached) return;
		try {
			// do not attach to our modal internals
			if (el.closest && el.closest('.wa-branches-modal')) return;
			el.addEventListener('click', function (ev) {
				// open our modal in addition to any widget behavior
				try { openModal(); } catch(e){}
			}, { capture: true });
			el.__waInterceptAttached = true;
		} catch (e) {}
	}

	function scanAndAttachToDelight() {
		// Look for nodes that likely belong to the delightchat widget.
		const candidates = Array.from(document.querySelectorAll('iframe[src], script[src], [class]'));
		for (const node of candidates) {
			try {
				if (node.closest && node.closest('.wa-branches-modal')) continue;
				const src = (node.getAttribute && (node.getAttribute('src') || '').toLowerCase()) || '';
				const cls = (node.className || '').toLowerCase();
				if (src.includes('delightchat') || src.includes('d2mpatx') || cls.includes('delight') || cls.includes('whatsapp')) {
					attachInterceptToElement(node);
				}
			} catch (e) {}
		}

		// also attach to visible floating buttons/anchors with whatsapp aria/text
		const icons = Array.from(document.querySelectorAll('button, a, div')).filter(n => {
			if (n.closest && n.closest('.wa-branches-modal')) return false;
			try {
				const aria = (n.getAttribute && n.getAttribute('aria-label') || '').toLowerCase();
				const txt = (n.textContent || '').toLowerCase();
				const cls = (n.className || '').toLowerCase();
				return aria.includes('whatsapp') || txt.includes('whatsapp') || cls.includes('delight') || cls.includes('whatsapp');
			} catch(e){ return false; }
		});
		icons.forEach(attachInterceptToElement);
	}

	function observeForWidget() {
		// initial scan
		scanAndAttachToDelight();
		// Observe DOM changes to catch widget when it loads
		const obs = new MutationObserver(function (mutations) {
			for (const m of mutations) {
				if (m.addedNodes && m.addedNodes.length) {
					scanAndAttachToDelight();
				}
			}
		});
		obs.observe(document.body, { childList: true, subtree: true });
	}

	/* ---------- Init ---------- */
	document.addEventListener('DOMContentLoaded', function () {
		createFab();
		createModal();
		observeForWidget();
		// keyboard accessibility
		const fab = document.querySelector('.wa-fab');
		if (fab) {
			fab.setAttribute('role', 'button');
			fab.setAttribute('tabindex', '0');
			fab.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(); }});
		}
	});
})();
