'use strict'; /* global Vue */

(function () {
	let miscitems = fetch('https://raw.githubusercontent.com/ALCHElVlY/d2data/master/json/misc.json');

	function first (...values) {
		return values.filter(v => v !== undefined).shift();
	}

	new Vue({
		el: '#miscitemstab',
		data: {
			visible: false,
			pageTitle: 'Diablo II: Resurrected Data Browser | Misc Items',
			items: [],
			sortColumn: undefined,
			contains: '',
			levelreqlower: 0,
			levelrequpper: 99,
			maxlevelreq: 99,
			version: 'All',
			itemtype: 'All',
			itemtypes: { All: 'All' },
			defaults: {
				value: '??',
				headstyle: 'width:1px;user-select:none;cursor:pointer;text-align:center;',
				style: 'text-align:center;',
			},
			columns: [
				{ label: '', value: '', headstyle: 'width:auto;user-select:none;cursor:pointer;' },
				{ label: 'Name', key: 'name', render: item => item.name, headstyle: 'width:1px;user-select:none;cursor:pointer;text-align:center;white-space:nowrap;', style: 'text-align:left;white-space:nowrap;' },
				{ label: 'Type', key: 'type', render: item => item.type || '??', sortDefault: '??', tooltip: 'Item category.' },
				{ label: 'Required Level', key: 'levelreq', render: item => item.levelreq || 0, sortDefault: 0 },
				{ label: 'Maximum Sockets', key: 'gemsockets', render: item => item.gemsockets || 0, sortDefault: 0 },
				{ label: 'Stackable', key: 'stackable', render: item => item.stackable ? 'Yes (' + item.minstack + '-' + item.maxstack + ')' : 'No', sortDefault: 'No' },
				{ label: 'Version', key: 'version', render: item => item.version === 100 ? 'Lord of Destruction' : 'Classic', sortDefault: 'Classic' },
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
				this.itemtype = 'All';
			},
			canShow: function (item) {
				if (item.name.toLowerCase().indexOf(this.contains.toLowerCase()) < 0) return false;
				if (this.itemtype !== 'All' && this.itemtype !== item.type) return false;
				if (+this.levelreqlower && +(item.levelreq || 0) < +this.levelreqlower) return false;
				if (+this.levelrequpper < this.maxlevelreq && +(item.levelreq || 0) > +this.levelrequpper) return false;
				if (this.version === 'Classic' && item.version !== 0) return false;
				if (this.version === 'LoD' && item.version !== 100) return false;
				return true;
			},
			first,
		},
		created: async function () {
			let miscItemsResponse = await miscitems;
			let miscItemsJson = await miscItemsResponse.json();
			this.items = Object.values(miscItemsJson).filter(i => i.spawnable);

			this.items.forEach(i => {
				this.itemtypes[i.type || 'none'] = i.type || 'none';
			});

			let maxlvl = Math.max(...this.items.map(i => i.levelreq || 0));
			this.maxlevelreq = this.levelrequpper = maxlvl || 99;
			this.visible = true;
		},
	});
})();
