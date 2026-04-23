'use strict'; /* global Vue */
(function () {
	let itemsPromise = fetch('https://raw.githubusercontent.com/ALCHElVlY/d2data/master/json/uniqueitems.json');
	let propsPromise = fetch('https://raw.githubusercontent.com/ALCHElVlY/d2data/master/json/properties.json');
	function first (...values) {
		return values.filter(v => v !== undefined).shift();
	}
	function parseProps(item, properties, propPrefix, minPrefix, maxPrefix, count) {
		let result = [];
		for (let i = 1; i <= count; i++) {
			let code = item[propPrefix + i];
			if (!code || code.startsWith('*')) continue;
			let mn = item[minPrefix + i];
			let mx = item[maxPrefix + i];
			let tooltip = (properties[code] && properties[code]['*Tooltip']) || code;
			let range = mn !== undefined
				? (mx !== undefined && mx !== mn ? mn + '-' + mx : String(mn))
				: '';
			result.push(tooltip.replace(/#/g, range));
		}
		return result.join(', ') || '—';
	}
	new Vue({
		el: '#uniqueitemsapp',
		data: {
			visible: false,
			pageTitle: 'Diablo 2 Unique Items',
			items: [],
			sortColumn: undefined,
			contains: '',
			levelreqlower: 0,
			levelrequpper: 99,
			maxlevelreq: 99,
			version: 'All',
			defaults: {
				value: '??',
				headstyle: 'width:1px;user-select:none;cursor:pointer;text-align:center;',
				style: 'text-align:center;',
			},
			columns: [
				{ label: '', value: '', headstyle: 'width:auto;user-select:none;cursor:pointer;' },
				{ label: 'Unique Name', key: 'index', render: item => item.index, headstyle: 'width:1px;user-select:none;cursor:pointer;text-align:center;white-space:nowrap;', style: 'text-align:left;white-space:nowrap;' },
				{ label: 'Base Item', key: 'ItemName', render: item => item['*ItemName'] || '??', sortDefault: '??' },
				{ label: 'Req Level', key: 'levelreq', render: item => item['lvl req'] || 0, sortDefault: 0, tooltip: 'Required character level.' },
				{ label: 'Version', key: 'version', render: item => item.version === 100 ? 'LoD' : 'Classic', sortDefault: 'Classic' },
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
				this.levelreqlower = 0;
				this.levelrequpper = this.maxlevelreq;
				this.version = 'All';
			},
			canShow: function (item) {
				if (item.index.toLowerCase().indexOf(this.contains.toLowerCase()) < 0) return false;
				if (+this.levelreqlower && +(item['lvl req'] || 0) < +this.levelreqlower) return false;
				if (+this.levelrequpper < this.maxlevelreq && +(item['lvl req'] || 0) > +this.levelrequpper) return false;
				if (this.version === 'Classic' && item.version !== 0) return false;
				if (this.version === 'LoD' && item.version !== 100) return false;
				return true;
			},
			first,
		},
		created: async function () {
			let [itemsRes, propsRes] = await Promise.all([itemsPromise, propsPromise]);
			let itemsData = await itemsRes.json();
			let properties = await propsRes.json();
			this.items = Object.values(itemsData)
				.filter(i => i.spawnable)
				.map(i => {
					i.parsedProps = parseProps(i, properties, 'prop', 'min', 'max', 12);
					return i;
				});
			let maxlvl = Math.max(...this.items.map(i => i['lvl req'] || 0));
			this.maxlevelreq = this.levelrequpper = maxlvl;
			this.visible = true;
		},
	});
})();
