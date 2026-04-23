'use strict'; /* global Vue */

(function () {
	let data = fetch('https://raw.githubusercontent.com/ALCHElVlY/d2data/master/json/setitems.json');

	function first (...values) {
		return values.filter(v => v !== undefined).shift();
	}

	function renderProps (item, count) {
		let props = [];
		for (let i = 1; i <= count; i++) {
			let prop = item['prop' + i];
			if (prop) {
				let mn = item['min' + i], mx = item['max' + i];
				let range = mn !== undefined ? ' (' + mn + (mx !== undefined && mx !== mn ? '-' + mx : '') + ')' : '';
				props.push(prop + range);
			}
		}
		return props.join(', ') || '—';
	}

	function renderAProps (item) {
		let props = [];
		for (let i = 1; i <= 5; i++) {
			let prop = item['aprop' + i + 'a'];
			if (prop) {
				let mn = item['amin' + i + 'a'], mx = item['amax' + i + 'a'];
				let range = mn !== undefined ? ' (' + mn + (mx !== undefined && mx !== mn ? '-' + mx : '') + ')' : '';
				props.push(prop + range);
			}
		}
		return props.join(', ') || '—';
	}

	new Vue({
		el: '#setitemsapp',
		data: {
			visible: false,
			pageTitle: 'Diablo 2 Set Items',
			items: [],
			sortColumn: undefined,
			contains: '',
			setcontains: '',
			levelreqlower: 0,
			levelrequpper: 99,
			maxlevelreq: 99,
			defaults: {
				value: '??',
				headstyle: 'width:1px;user-select:none;cursor:pointer;text-align:center;',
				style: 'text-align:center;',
			},
			columns: [
				{ label: '', value: '', headstyle: 'width:auto;user-select:none;cursor:pointer;' },
				{ label: 'Item Name', key: 'index', render: item => item.index, headstyle: 'width:1px;user-select:none;cursor:pointer;text-align:center;white-space:nowrap;', style: 'text-align:left;white-space:nowrap;', tooltip: 'The set item name.' },
				{ label: 'Set', key: 'set', render: item => item.set || '??', sortDefault: '??', headstyle: 'width:1px;user-select:none;cursor:pointer;text-align:center;white-space:nowrap;', style: 'text-align:left;white-space:nowrap;', tooltip: 'The set this item belongs to.' },
				{ label: 'Base Item', key: 'ItemName', render: item => item['*ItemName'] || '??', sortDefault: '??', tooltip: 'The base item type.' },
				{ label: 'Req Level', key: 'levelreq', render: item => item['lvl req'] || 0, sortDefault: 0, tooltip: 'Required character level to equip.' },
				{ label: 'Properties', key: 'props', render: item => renderProps(item, 9), headstyle: 'width:auto;user-select:none;cursor:pointer;', style: 'text-align:left;font-size:0.85em;', tooltip: 'Own item properties.' },
				{ label: 'Set Bonuses', key: 'setbonus', render: item => renderAProps(item), headstyle: 'width:auto;user-select:none;cursor:pointer;', style: 'text-align:left;font-size:0.85em;', tooltip: 'Partial set bonuses.' },
				{ label: '', value: '', headstyle: 'width:auto;user-select:none;cursor:pointer;' },
			],
		},
		methods: {
			sort: function (column) {
				if (this.sortColumn === column) {
					column.sortOrder = -column.sortOrder;
				} else {
					if (this.sortColumn) {
						delete this.sortColumn.headclass;
					}
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
				this.setcontains = '';
				this.levelreqlower = 0;
				this.levelrequpper = this.maxlevelreq;
			},
			canShow: function (item) {
				if (item.index.toLowerCase().indexOf(this.contains.toLowerCase()) < 0) return false;
				if (this.setcontains && item.set.toLowerCase().indexOf(this.setcontains.toLowerCase()) < 0) return false;
				if (+this.levelreqlower && +(item['lvl req'] || 0) < +this.levelreqlower) return false;
				if (+this.levelrequpper < this.maxlevelreq && +(item['lvl req'] || 0) > +this.levelrequpper) return false;
				return true;
			},
			first,
		},
		created: async function () {
			dat = await data;
			dat = await data.json();
			this.items = Object.values(data).filter(i => i.spawnable);
			let maxlvl = Math.max(...this.items.map(i => i['lvl req'] || 0));
			this.maxlevelreq = this.levelrequpper = maxlvl;
			this.visible = true;
		},
	});
})();
