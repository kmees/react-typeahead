/**
 * @jsx React.DOM
 */

var React = require('react/addons');
var TypeaheadSelector = require('./selector');
var KeyEvent = require('../keyevent');
var fuzzy = require('fuzzy');
var classNames = require('classnames');

var getType = {};
var isFunction = function(f) {
  return getType.toString.call(f) === "[object Function]"
}

/**
 * A "typeahead", an auto-completing text input
 *
 * Renders an text input that shows options nearby that you can use the
 * keyboard or mouse to select.  Requires CSS for MASSIVE DAMAGE.
 */
var Typeahead = React.createClass({
  propTypes: {
    name: React.PropTypes.string,
    customClasses: React.PropTypes.object,
    CustomComponent: React.PropTypes.oneOfType([
      React.PropTypes.func,
      React.PropTypes.string
    ]),
    inputQuerySel: React.PropTypes.string,
    maxVisible: React.PropTypes.number,
    options: React.PropTypes.array,
    allowCustomValues: React.PropTypes.oneOfType([
      React.PropTypes.number,
      React.PropTypes.func
    ]),
    defaultValue: React.PropTypes.string,
    placeholder: React.PropTypes.string,
    inputProps: React.PropTypes.object,
    onOptionSelected: React.PropTypes.func,
    onKeyDown: React.PropTypes.func,
    filterOption: React.PropTypes.func
  },

  getDefaultProps: function() {
    return {
      options: [],
      customClasses: {},
      CustomComponent: "input",
      inputQuerySel: "input",
      allowCustomValues: 0,
      defaultValue: "",
      placeholder: "",
      inputProps: {},
      onOptionSelected: function(option) {},
      onKeyDown: function(event) {},
      filterOption: null
    };
  },

  getInitialState: function() {
    return {
      // The currently visible set of options
      visible: this.getOptionsForValue(this.props.defaultValue, this.props.options),

      // This should be called something else, "entryValue"
      entryValue: this.props.defaultValue,

      // A valid typeahead value
      selection: null
    };
  },

  getOptionsForValue: function(value, options) {
    var result;
    if (this.props.filterOption) {
      result = options.filter((function(o) { return this.props.filterOption(value, o); }).bind(this));
    } else {
      result = fuzzy.filter(value, options).map(function(res) {
        return res.string;
      });
    }
    if (this.props.maxVisible) {
      result = result.slice(0, this.props.maxVisible);
    }
    return result;
  },

  setEntryText: function(value) {
    this.refs.container.getDOMNode().querySelector(this.props.inputQuerySel).value = value;
    this._onTextEntryUpdated();
  },

  _isValidCustomValue: function() {
    var isValidCustomValue = false

    if (isFunction(this.props.allowCustomValues)) {
      isValidCustomValue = this.props.allowCustomValues(this.state.entryValue)
    } else {
      isValidCustomValue = this.props.allowCustomValues > 0 &&
        this.state.entryValue.length >= this.props.allowCustomValues
    }

    return isValidCustomValue;
  },

  _hasCustomValue: function() {
    if (this._isValidCustomValue() &&
      this.state.visible.indexOf(this.state.entryValue) < 0) {
      return true;
    }
    return false;
  },

  _getCustomValue: function() {
    if (this._hasCustomValue()) {
      return this.state.entryValue;
    }
    return null
  },

  _renderIncrementalSearchResults: function() {
    // Nothing has been entered into the textbox
    if (!this.state.entryValue) {
      return "";
    }

    // Something was just selected
    if (this.state.selection) {
      return "";
    }

    // There are no typeahead / autocomplete suggestions
    if (!this.state.visible.length && !(isFunction(this.props.allowCustomValues) ||this.props.allowCustomValues > 0)) {
      return "";
    }

    if (this._hasCustomValue()) {
      return (
        <TypeaheadSelector
          ref="sel" options={this.state.visible}
          customValue={this.state.entryValue}
          onOptionSelected={this._onOptionSelected}
          customClasses={this.props.customClasses} />
      );
    }

    return (
      <TypeaheadSelector
        ref="sel" options={ this.state.visible }
        onOptionSelected={ this._onOptionSelected }
        customClasses={this.props.customClasses} />
   );
  },

  _onOptionSelected: function(option, event) {
    var nEntry = this.refs.container.getDOMNode().querySelector(this.props.inputQuerySel);
    nEntry.focus();
    nEntry.value = option;
    this.setState({visible: this.getOptionsForValue(option, this.props.options),
                   selection: option,
                   entryValue: option});
    return this.props.onOptionSelected(option, event);
  },

  _onTextEntryUpdated: function() {
    var value = this.refs.container.getDOMNode().querySelector(this.props.inputQuerySel).value;
    this.setState({visible: this.getOptionsForValue(value, this.props.options),
                   selection: null,
                   entryValue: value});
  },

  _onEnter: function(event) {
    if (!this.refs.sel.state.selection) {
      return this.props.onKeyDown(event);
    }
    return this._onOptionSelected(this.refs.sel.state.selection, event);
  },

  _onEscape: function() {
    this.refs.sel.setSelectionIndex(null)
  },

  _onTab: function(event) {
    var option = this.refs.sel.state.selection ?
      this.refs.sel.state.selection : (this.state.visible.length > 0 ? this.state.visible[0] : null);

    if (option === null && this._hasCustomValue()) {
      option = this._getCustomValue();
    }

    if (option !== null) {
      return this._onOptionSelected(option, event);
    }
  },

  eventMap: function(event) {
    var events = {};

    events[KeyEvent.DOM_VK_UP] = this.refs.sel.navUp;
    events[KeyEvent.DOM_VK_DOWN] = this.refs.sel.navDown;
    events[KeyEvent.DOM_VK_RETURN] = events[KeyEvent.DOM_VK_ENTER] = this._onEnter;
    events[KeyEvent.DOM_VK_ESCAPE] = this._onEscape;
    events[KeyEvent.DOM_VK_TAB] = this._onTab;

    return events;
  },

  _onKeyDown: function(event) {
    // If there are no visible elements, don't perform selector navigation.
    // Just pass this up to the upstream onKeydown handler
    if (!this.refs.sel) {
      return this.props.onKeyDown(event);
    }

    var handler = this.eventMap()[event.keyCode];

    if (handler) {
      handler(event);
    } else {
      return this.props.onKeyDown(event);
    }
    // Don't propagate the keystroke back to the DOM/browser
    event.preventDefault();
  },

  componentWillReceiveProps: function(nextProps) {
    this.setState({
      visible: this.getOptionsForValue(this.state.entryValue, nextProps.options)
    });
  },

  render: function() {
    var inputClasses = {}
    inputClasses[this.props.customClasses.input] = !!this.props.customClasses.input;
    var inputClassList = classNames(inputClasses);

    var classes = {
      typeahead: true
    }
    classes[this.props.className] = !!this.props.className;
    var classList = classNames(classes);

    return (
      <div ref="container" className={classList}>
        <this.props.CustomComponent ref="entry" type="text"
          {...this.props.inputProps}
          placeholder={this.props.placeholder}
          className={inputClassList}
          value={this.state.entryValue}
          defaultValue={this.props.defaultValue}
          onChange={this._onTextEntryUpdated} onKeyDown={this._onKeyDown} />
        { this._renderIncrementalSearchResults() }
      </div>
    );
  },

  _renderHiddenInput: function() {
    if (!this.props.name) {
      return null;
    }

    return (
      <input
        type="hidden"
        name={ this.props.name }
        value={ this.state.selection }
      />
    );
  }
});

module.exports = Typeahead;
