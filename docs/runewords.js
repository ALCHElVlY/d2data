'use strict'; /* global Vue */

(function () {
	let runesPromise = fetch('https://raw.githubusercontent.com/ALCHElVlY/d2data/master/json/runes.json');
	let propsPromise = fetch('https://raw.githubusercontent.com/ALCHElVlY/d2data/master/json/properties.json');

	function first (...values) {
		return values.filter(v => v !== undefined).shift();
	}

	const CLASS_SKILL_LABELS = {
		ama: 'Amazon Skills', sor: 'Sorceress Skills', nec: 'Necromancer Skills',
		pal: 'Paladin Skills', bar: 'Barbarian Skills', dru: 'Druid Skills',
		war: 'Assassin Skills',
	};

	function parseRunewordProps(item, properties) {
		let result = [];
		for (let i = 1; i <= 7; i++) {
			let code = item['T1Code' + i];
			if (!code) continue;
			let mn = item['T1Min' + i];
			let mx = item['T1Max' + i];
			let param = item['T1Param' + i];
			// Class skill shorthand
			if (CLASS_SKILL_LABELS[code]) {
				let val = mn !== undefined ? '+' + mn + ' to ' : '';
				result.push(val + CLASS_SKILL_LABELS[code]);
				continue;
			}
			let tooltip = (properties[code] && properties[code]['*Tooltip']) || code;
			let range = mn !== undefined
				? (mx !== undefined && mx !== mn ? mn + '-' + mx : String(mn))
				: '';
			let line = tooltip.replace(/#/g, range);
			if (param && typeof param === 'string' && isNaN(param)) {
				line += ' (' + param + ')';
			}
			result.push(line);
		}
		return result.join('\n') || '—';
	}

	function parseAllowedTypes(item) {
		let types = [];
		for (let i = 1; i <= 6; i++) {
			let t = item['itype' + i];
			if (t) types.push(t);
		}
		return types.join(', ') || '—';
	}

	new Vue({
		el: '#runewordsapp',
		data: {
			visible: false,
			pageTitle: 'Diablo 2 Runewords',
			items: [],
			sortColumn: undefined,
			contains: '',
			runecontains: '',
			itemtype: 'All',
			itemtypes: { All: 'All' },
			defaults: {
				value: '??',
				headstyle: 'width:1px;user-select:none;cursor:pointer;text-align:center;',
				style: 'text-align:center;',
			},
			columns: [
				{ label: '', value: '', headstyle: 'width:auto;user-select:none;cursor:pointer;' },
				{ label: 'Runeword', key: 'runeName', render: item => item.runeName, headstyle: 'width:1px;user-select:none;cursor:pointer;text-align:center;white-space:nowrap;', style: 'text-align:left;white-space:nowrap;' },
				{ label: 'Runes', key: 'runesUsed', render: item => item['*RunesUsed'] || '—', sortDefault: '—', headstyle: 'width:1px;user-select:none;cursor:pointer;text-align:center;white-space:nowrap;', style: 'text-align:left;white-space:nowrap;' },
				{ label: 'Sockets', key: 'sockets', render: item => item.sockets, sortDefault: 0 },
				{ label: 'Allowed Types', key: 'allowedTypes', render: item => item.allowedTypes, headstyle: 'width:1px;user-select:none;cursor:pointer;text-align:center;white-space:nowrap;', style: 'text-align:left;white-space:nowrap;' },
				{ label: 'Properties', key: 'parsedProps', render: item => item.parsedProps, headstyle: 'width:auto;user-select:none;cursor:pointer;', style: 'text-align:left;font-size:0.85em;white-space:pre-wrap;' },
				{ label: '', value: '', headstyle: 'width:auto;user-select:none;cursor:pointer;' },
			],
		},
		methods: {
			sort: function (column) {
				if (this.sortColumn === column) {
					column.sortOrder = -column.sortOrder;
				} else {
					if (this.sortColumn) delete this.sortColumn.headclass;
					this.sortColumn = column;
					column.sortOrder = column.sortOrder || column.defaultSortOrder || 1;
				}
				column.headclass = column.sortOrder > 0 ? 'text-primary' : 'text-danger';
				this.items = this.items.sort((a, b) => {
					let av = first(column.value, a[column.key], column.sortDefault);
					let bv = first(column.value, b[column.key], column.sortDefault);
					return av < bv ? -column.sortOrder : av > bv ? column.sortOrder : 0;
				});
			},
			resetValues: function () {
				this.contains = '';
				this.runecontains = '';
				this.itemtype = 'All';
			},
			canShow: function (item) {
				if (item.runeName.toLowerCase().indexOf(this.contains.toLowerCase()) < 0) return false;
				if (this.runecontains && !(item['*RunesUsed'] || '').toLowerCase().includes(this.runecontains.toLowerCase())) return false;
				if (this.itemtype !== 'All' && !item.allowedTypes.includes(this.itemtype)) return false;
				return true;
			},
			first,
		},
		created: async function () {
			let [runesRes, propsRes] = await Promise.all([runesPromise, propsPromise]);
			let runesData = await runesRes.json();
			let properties = await propsRes.json();
			this.items = Object.values(runesData)
				.filter(i => i.complete === 1)
				.map(i => {
					i.runeName = i['*Rune Name'];
					i.allowedTypes = parseAllowedTypes(i);
					i.parsedProps = parseRunewordProps(i, properties);
					// count sockets = number of Rune{n} keys present
					let s = 0;
					for (let n = 1; n <= 6; n++) { if (i['Rune' + n]) s++; }
					i.sockets = s;
					// collect unique item types for filter dropdown
					for (let n = 1; n <= 6; n++) {
						if (i['itype' + n]) this.itemtypes[i['itype' + n]] = i['itype' + n];
					}
					return i;
				});
			this.visible = true;
		},
	});
})();
