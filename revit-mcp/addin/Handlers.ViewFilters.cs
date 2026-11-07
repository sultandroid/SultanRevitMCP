using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Nodes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

namespace RevitMcp
{
    internal static partial class Handlers
    {
        /// <summary>
        /// Creates or updates a rule-based view filter on one text parameter (project or shared, by name) and applies it to views
        /// with graphic overrides. Used for coordination views: existing work by SF_PhaseStatus, reservations by SF_Maturity.
        /// Host-view filters also act on linked models shown By Host View, so one filter set works in a federated host.
        /// params: name, parameter, rule (equals | begins_with | contains | not_equals), value, view_ids,
        ///   optional categories (OST_ names; default: every filterable category that has the parameter),
        ///   optional overrides: halftone, color {r,g,b} (lines + solid surface/cut fill), transparency 0-100, line_pattern (name), visible.
        /// Filters keep the order they were first added to a view; the top one wins, so add the highest-priority filter first.
        /// </summary>
        private static JsonNode EnsureViewFilter(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var name = ReqStr(p, "name");
            var paramName = ReqStr(p, "parameter");
            var ruleKind = (Str(p, "rule") ?? "equals").ToLowerInvariant();
            var value = ReqStr(p, "value");
            var viewIds = ReqIds(p, "view_ids");
            var paramId = FindTextParameterId(doc, paramName)
                ?? throw new ArgumentException($"No project or shared parameter named '{paramName}' is bound in this model.");
            List<ElementId> cats;
            if (p["categories"] is JsonArray arr)
                cats = arr.Select(n => ResolveCategory(doc, n.GetValue<string>()).Id).ToList();
            else
                cats = ParameterFilterUtilities.GetAllFilterableCategories()
                    .Where(c => ParameterFilterUtilities.GetFilterableParametersInCommon(doc, new List<ElementId> { c }).Contains(paramId)).ToList();
            if (cats.Count == 0) throw new ArgumentException($"No filterable category has '{paramName}'.");
            FilterRule rule = ruleKind switch
            {
                "equals" => ParameterFilterRuleFactory.CreateEqualsRule(paramId, value),
                "not_equals" => ParameterFilterRuleFactory.CreateNotEqualsRule(paramId, value),
                "begins_with" => ParameterFilterRuleFactory.CreateBeginsWithRule(paramId, value),
                "contains" => ParameterFilterRuleFactory.CreateContainsRule(paramId, value),
                _ => throw new ArgumentException("rule must be equals, not_equals, begins_with or contains.")
            };
            var halftone = p["halftone"]?.GetValue<bool>();
            Color color = p["color"] is JsonObject ? ColorOf(p, "color") : null;
            var transparency = (int?)Num(p, "transparency");
            var visible = p["visible"]?.GetValue<bool>() ?? true;
            var patternName = Str(p, "line_pattern");
            var linePattern = patternName == null ? null
                : LinePatternElement.GetLinePatternElementByName(doc, patternName) ?? throw new ArgumentException($"No line pattern named '{patternName}'.");
            return InTransaction(doc, "Ensure view filter", () =>
            {
                var filter = new ElementParameterFilter(rule);
                var pfe = new FilteredElementCollector(doc).OfClass(typeof(ParameterFilterElement)).Cast<ParameterFilterElement>().FirstOrDefault(f => f.Name == name);
                var created = pfe == null;
                if (created) pfe = ParameterFilterElement.Create(doc, name, cats, filter);
                else { pfe.SetCategories(cats); pfe.SetElementFilter(filter); }
                var solid = color == null ? null : new FilteredElementCollector(doc).OfClass(typeof(FillPatternElement)).Cast<FillPatternElement>().First(f => f.GetFillPattern().IsSolidFill);
                var settings = new OverrideGraphicSettings();
                if (halftone.HasValue) settings.SetHalftone(halftone.Value);
                if (color != null)
                {
                    settings.SetProjectionLineColor(color); settings.SetCutLineColor(color);
                    settings.SetSurfaceForegroundPatternId(solid.Id); settings.SetSurfaceForegroundPatternColor(color);
                    settings.SetCutForegroundPatternId(solid.Id); settings.SetCutForegroundPatternColor(color);
                }
                if (transparency.HasValue) settings.SetSurfaceTransparency(transparency.Value);
                if (linePattern != null) { settings.SetProjectionLinePatternId(linePattern.Id); settings.SetCutLinePatternId(linePattern.Id); }
                var views = new JsonArray();
                foreach (var id in viewIds)
                {
                    var view = doc.GetElement(id) as View;
                    if (view == null || !view.AreGraphicsOverridesAllowed()) { views.Add(id.Value + ": skipped"); continue; }
                    if (!view.GetFilters().Contains(pfe.Id)) view.AddFilter(pfe.Id);
                    view.SetFilterOverrides(pfe.Id, settings);
                    view.SetFilterVisibility(pfe.Id, visible);
                    views.Add(id.Value + ": applied");
                }
                return new JsonObject { ["filter_id"] = pfe.Id.Value, ["created"] = created, ["categories"] = cats.Count, ["parameter_id"] = paramId.Value, ["views"] = views };
            });
        }

        private static ElementId FindTextParameterId(Document doc, string name)
        {
            var it = doc.ParameterBindings.ForwardIterator();
            while (it.MoveNext())
                if (it.Key is InternalDefinition def && def.Name == name) return def.Id;
            return null;
        }
    }
}
