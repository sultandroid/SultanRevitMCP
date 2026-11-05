using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json.Nodes;
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Structure;
using Autodesk.Revit.UI;

namespace RevitMcp
{
    /// <summary>
    /// Analytical model for structural analysis (Robot Structural Analysis link, or any FEM tool that reads the Revit
    /// analytical model): analytical members with sections and releases, point supports, load cases, hosted line loads
    /// and load combinations. Forces in kN, line loads in kN/m, coordinates in mm.
    /// </summary>
    internal static partial class Handlers
    {
        /// <summary>Loads chosen types of a type-catalog family (for example IPE220 from IPE-Beams.rfa), not the whole catalog.</summary>
        private static JsonNode LoadFamilyTypes(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var path = ReqStr(p, "path");
            if (!File.Exists(path)) throw new ArgumentException($"Family file not found: '{path}'.");
            var names = (p["types"] as JsonArray ?? throw new ArgumentException("types is required.")).Select(n => n.GetValue<string>()).ToList();
            var famName = Path.GetFileNameWithoutExtension(path);
            return InTransaction(doc, $"Load types of {famName}", () =>
            {
                var result = new JsonArray();
                foreach (var name in names)
                {
                    var existing = new FilteredElementCollector(doc).OfClass(typeof(FamilySymbol)).Cast<FamilySymbol>()
                        .FirstOrDefault(s => s.Family.Name == famName && s.Name == name);
                    if (existing == null) { doc.LoadFamilySymbol(path, name, new KeepExistingFamily(), out existing); }
                    if (existing == null) { result.Add(new JsonObject { ["name"] = name, ["error"] = "not in the type catalog" }); continue; }
                    if (!existing.IsActive) existing.Activate();
                    result.Add(new JsonObject { ["name"] = name, ["id"] = existing.Id.Value, ["family"] = existing.Family.Name });
                }
                return new JsonObject { ["types"] = result };
            });
        }

        private static AnalyticalStructuralRole RoleOf(string role) => (role ?? "member").ToLowerInvariant() switch
        {
            "column" => AnalyticalStructuralRole.StructuralRoleColumn,
            "beam" => AnalyticalStructuralRole.StructuralRoleBeam,
            _ => AnalyticalStructuralRole.StructuralRoleMember,
        };

        private static ReleaseType ReleaseOf(string r) => (r ?? "fixed").ToLowerInvariant() switch
        {
            "pinned" => ReleaseType.Pinned,
            "bending" => ReleaseType.BendingMoment,
            _ => ReleaseType.Fixed,
        };

        /// <summary>
        /// members: [{start, end, section_type_id, material_id?, role: column|beam|member, release_start, release_end: fixed|pinned|bending,
        /// rotation_deg?, comments?}]. Returns the new analytical member ids in the same order.
        /// </summary>
        private static JsonNode CreateAnalyticalMembers(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var items = p["members"] as JsonArray ?? throw new ArgumentException("members is required.");
            return InTransaction(doc, "Create analytical members", () =>
            {
                var ids = new JsonArray();
                foreach (var node in items)
                {
                    var o = node.AsObject();
                    var a = ReqPoint(o, "start");
                    var b = ReqPoint(o, "end");
                    var m = AnalyticalMember.Create(doc, Line.CreateBound(a, b));
                    m.StructuralRole = RoleOf(Str(o, "role"));
                    if (o["section_type_id"] != null) m.SectionTypeId = ReqId(o, "section_type_id");
                    if (o["material_id"] != null) m.MaterialId = ReqId(o, "material_id");
                    if (Num(o, "rotation_deg") is double rot) m.CrossSectionRotation = rot * Math.PI / 180;
                    m.SetReleaseType(true, ReleaseOf(Str(o, "release_start")));
                    m.SetReleaseType(false, ReleaseOf(Str(o, "release_end")));
                    var c = Str(o, "comments");
                    if (c != null) m.get_Parameter(BuiltInParameter.ALL_MODEL_INSTANCE_COMMENTS)?.Set(c);
                    ids.Add(m.Id.Value);
                }
                return new JsonObject { ["created"] = ids.Count, ["ids"] = ids };
            });
        }

        /// <summary>
        /// supports: [{member_id, end: start|end, fixity: fixed|pinned}]. Point boundary conditions on the analytical member end.
        /// </summary>
        private static JsonNode CreatePointSupports(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var items = p["supports"] as JsonArray ?? throw new ArgumentException("supports is required.");
            return InTransaction(doc, "Create point supports", () =>
            {
                var ids = new JsonArray();
                var skipped = new JsonArray();
                foreach (var node in items)
                {
                    var o = node.AsObject();
                    var m = doc.GetElement(ReqId(o, "member_id")) as AnalyticalMember ?? throw new ArgumentException("member_id is not an analytical member.");
                    var atEnd = (Str(o, "end") ?? "start").ToLowerInvariant() == "end";
                    var curve = m.GetCurve();
                    var pt = curve.GetEndPoint(atEnd ? 1 : 0);
                    // the analytical node at that point (Revit 2023+ keeps nodes as their own elements); fall back to the member end reference
                    var anode = new FilteredElementCollector(doc).OfCategory(BuiltInCategory.OST_AnalyticalNodes).WhereElementIsNotElementType()
                        .OfType<ReferencePoint>().FirstOrDefault(n => n.Position.DistanceTo(pt) < 0.005);
                    Reference reference = null;
                    var sel = new AnalyticalModelSelector(atEnd ? AnalyticalCurveSelector.EndPoint : AnalyticalCurveSelector.StartPoint);
                    try { if (m.IsValidSelector(sel)) reference = m.GetReference(sel); } catch { }
                    if (reference == null && anode != null) reference = new Reference(anode);
                    if (reference == null)
                    {
                        try { reference = m.GetReference(new AnalyticalModelSelector(curve, atEnd ? AnalyticalCurveSelector.EndPoint : AnalyticalCurveSelector.StartPoint)); } catch { }
                    }
                    if (reference == null) throw new InvalidOperationException($"No analytical node or end reference at member {m.Id.Value} {(atEnd ? "end" : "start")}.");
                    var fixedRot = (Str(o, "fixity") ?? "fixed").ToLowerInvariant() == "fixed";
                    var T = TranslationRotationValue.Fixed;
                    var R = fixedRot ? TranslationRotationValue.Fixed : TranslationRotationValue.Release;
                    try
                    {
                        var bc = doc.Create.NewPointBoundaryConditions(reference, T, 0, T, 0, T, 0, R, 0, R, 0, R, 0);
                        ids.Add(bc.Id.Value);
                    }
                    catch (Exception e)
                    {
                        skipped.Add(new JsonObject { ["member_id"] = m.Id.Value, ["at"] = $"{ToMm(pt.X):0},{ToMm(pt.Y):0},{ToMm(pt.Z):0}", ["node"] = anode?.Id.Value, ["error"] = e.Message.Split('\n')[0] });
                    }
                }
                return new JsonObject { ["created"] = ids.Count, ["ids"] = ids, ["skipped"] = skipped };
            });
        }

        /// <summary>cases: [{name, nature: Dead|Live|Wind|..., category: Dead|Live|Wind|Snow|Seismic|Temperature|Accidental|RoofLive}]. Reuses a case of the same name.</summary>
        private static JsonNode CreateLoadCases(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var items = p["cases"] as JsonArray ?? throw new ArgumentException("cases is required.");
            return InTransaction(doc, "Create load cases", () =>
            {
                var result = new JsonArray();
                var natures = new FilteredElementCollector(doc).OfClass(typeof(LoadNature)).Cast<LoadNature>().ToList();
                var cases = new FilteredElementCollector(doc).OfClass(typeof(LoadCase)).Cast<LoadCase>().ToList();
                foreach (var node in items)
                {
                    var o = node.AsObject();
                    var name = ReqStr(o, "name");
                    var lc = cases.FirstOrDefault(c => c.Name == name);
                    if (lc == null)
                    {
                        var natureName = Str(o, "nature") ?? "Dead";
                        var nature = natures.FirstOrDefault(n => n.Name.Equals(natureName, StringComparison.OrdinalIgnoreCase))
                            ?? LoadNature.Create(doc, natureName);
                        var cat = (LoadCaseCategory)Enum.Parse(typeof(LoadCaseCategory), Str(o, "category") ?? natureName, true);
                        lc = LoadCase.Create(doc, name, nature.Id, cat);
                    }
                    result.Add(new JsonObject { ["name"] = lc.Name, ["id"] = lc.Id.Value, ["number"] = lc.Number });
                }
                var all = new JsonArray(new FilteredElementCollector(doc).OfClass(typeof(LoadCase)).Cast<LoadCase>()
                    .Select(c => (JsonNode)new JsonObject { ["name"] = c.Name, ["id"] = c.Id.Value, ["number"] = c.Number }).ToArray());
                return new JsonObject { ["cases"] = result, ["all"] = all };
            });
        }

        /// <summary>loads: [{member_id, case_id, fx, fy, fz}] uniform line loads in kN/m (global axes) hosted on analytical members.</summary>
        private static JsonNode CreateLineLoads(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var items = p["loads"] as JsonArray ?? throw new ArgumentException("loads is required.");
            double U(double kNm) => UnitUtils.ConvertToInternalUnits(kNm, UnitTypeId.KilonewtonsPerMeter);
            return InTransaction(doc, "Create line loads", () =>
            {
                var ids = new JsonArray();
                foreach (var node in items)
                {
                    var o = node.AsObject();
                    var f = new XYZ(U(Num(o, "fx") ?? 0), U(Num(o, "fy") ?? 0), U(Num(o, "fz") ?? 0));
                    var load = LineLoad.Create(doc, ReqId(o, "member_id"), f, XYZ.Zero, null);
                    load.LoadCaseId = ReqId(o, "case_id");
                    ids.Add(load.Id.Value);
                }
                return new JsonObject { ["created"] = ids.Count, ["ids"] = ids };
            });
        }

        /// <summary>combinations: [{name, state: ultimate|serviceability, factors: [{case_id, factor}]}]. Replaces the factors of a combination of the same name.</summary>
        private static JsonNode CreateLoadCombinations(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var items = p["combinations"] as JsonArray ?? throw new ArgumentException("combinations is required.");
            return InTransaction(doc, "Create load combinations", () =>
            {
                var result = new JsonArray();
                var existing = new FilteredElementCollector(doc).OfClass(typeof(LoadCombination)).Cast<LoadCombination>().ToList();
                foreach (var node in items)
                {
                    var o = node.AsObject();
                    var name = ReqStr(o, "name");
                    var state = (Str(o, "state") ?? "ultimate").ToLowerInvariant() == "serviceability" ? LoadCombinationState.Serviceability : LoadCombinationState.Ultimate;
                    var combo = existing.FirstOrDefault(c => c.Name == name) ?? LoadCombination.Create(doc, name, LoadCombinationType.Combination, state);
                    var comps = (o["factors"] as JsonArray ?? new JsonArray()).Select(n => new LoadComponent(ReqId(n.AsObject(), "case_id"), ReqNum(n.AsObject(), "factor"))).ToList();
                    combo.SetComponents(comps);
                    result.Add(new JsonObject { ["name"] = combo.Name, ["id"] = combo.Id.Value });
                }
                return new JsonObject { ["combinations"] = result };
            });
        }
    }
}
