using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.Json.Nodes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

namespace RevitMcp
{
    /// <summary>
    /// Joinery parts as real, schedulable Revit elements.
    ///
    /// build_part_family: makes SF_Part_Box.rfa, a Generic Model box driven by three locked reference planes
    ///   (SF_SizeX / SF_SizeY / SF_SizeZ from the origin), with SF_Part Material, SF_Part Code, SF_Part Name, SF_Item and
    ///   SF_Cut L / W / T (the board cut size: longest, middle and shortest side, by formula). All shared instance
    ///   parameters, family "Shared", so every nested part shows in project schedules (BOM straight from Revit).
    ///   Params: template_path (Metric Generic Model.rft), save_path (.rfa). Returns a flex test.
    ///
    /// build_part_assembly_family: makes one item family from a parts list by nesting SF_Part_Box once per part.
    ///   Params: template_path, part_family_path, family_name, save_dir, parts [{min:[x,y,z], max:[x,y,z], mat, code, name}]
    ///   in project mm, item (text), materials {name: {r,g,b}} (optional colours), level_id (place in the active project
    ///   at the parts' lowest corner, optional), mark, comments.
    ///   The item family is regenerated from the parts list (the generator script is the parametric source).
    /// </summary>
    internal static partial class Handlers
    {
        // Fixed GUIDs: the same parameters in every family and project, so schedules and filters match across jobs.
        private static readonly (string Name, string Guid, string Kind)[] PartParams =
        {
            ("SF_SizeX", "3f6c1a52-8d0e-4b7a-9c21-5e7d4a1b0c01", "len"),
            ("SF_SizeY", "3f6c1a52-8d0e-4b7a-9c21-5e7d4a1b0c02", "len"),
            ("SF_SizeZ", "3f6c1a52-8d0e-4b7a-9c21-5e7d4a1b0c03", "len"),
            ("SF_Cut L", "3f6c1a52-8d0e-4b7a-9c21-5e7d4a1b0c04", "len"),
            ("SF_Cut W", "3f6c1a52-8d0e-4b7a-9c21-5e7d4a1b0c05", "len"),
            ("SF_Cut T", "3f6c1a52-8d0e-4b7a-9c21-5e7d4a1b0c06", "len"),
            ("SF_Part Material", "3f6c1a52-8d0e-4b7a-9c21-5e7d4a1b0c07", "mat"),
            ("SF_Part Code", "3f6c1a52-8d0e-4b7a-9c21-5e7d4a1b0c08", "text"),
            ("SF_Part Name", "3f6c1a52-8d0e-4b7a-9c21-5e7d4a1b0c09", "text"),
            ("SF_Item", "3f6c1a52-8d0e-4b7a-9c21-5e7d4a1b0c10", "text"),
        };

        private static double Dbl(JsonNode n) => double.Parse(n.ToString(), CultureInfo.InvariantCulture);
        private static XYZ MmVec(JsonNode n) { var a = n.AsArray(); return new XYZ(FromMm(Dbl(a[0])), FromMm(Dbl(a[1])), FromMm(Dbl(a[2]))); }

        private static JsonNode BuildPartFamily(UIApplication app, JsonObject p)
        {
            var template = ReqStr(p, "template_path");
            if (!File.Exists(template)) throw new ArgumentException($"Template not found: '{template}'.");
            var savePath = ReqStr(p, "save_path");
            var rvt = app.Application;
            var fdoc = rvt.NewFamilyDocument(template);
            var oldFile = rvt.SharedParametersFilename;
            var tmp = Path.Combine(Path.GetTempPath(), $"sultan_sp_{Guid.NewGuid():N}.txt");
            File.WriteAllText(tmp, "");
            var flex = new JsonArray();
            try
            {
                rvt.SharedParametersFilename = tmp;
                var group = rvt.OpenSharedParameterFile().Groups.Create("Samaya Factory Parts");
                var fm = fdoc.FamilyManager;
                var fp = new Dictionary<string, FamilyParameter>();
                using (var t = new Transaction(fdoc, "MCP: Part family"))
                {
                    t.Start();
                    if (fm.CurrentType == null) fm.NewType("Part");
                    foreach (var (name, guid, kind) in PartParams)
                    {
                        var spec = kind == "len" ? SpecTypeId.Length : kind == "mat" ? SpecTypeId.Reference.Material : SpecTypeId.String.Text;
                        var def = group.Definitions.Create(new ExternalDefinitionCreationOptions(name, spec) { GUID = Guid.Parse(guid) }) as ExternalDefinition;
                        var grp = kind == "len" ? GroupTypeId.Geometry : kind == "mat" ? GroupTypeId.Materials : GroupTypeId.IdentityData;
                        fp[name] = fm.AddParameter(def, grp, true);
                    }
                    fm.Set(fp["SF_SizeX"], FromMm(600)); fm.Set(fp["SF_SizeY"], FromMm(400)); fm.Set(fp["SF_SizeZ"], FromMm(18));

                    var plan = new FilteredElementCollector(fdoc).OfClass(typeof(ViewPlan)).Cast<ViewPlan>().First(v => !v.IsTemplate && v.Name == "Ref. Level");
                    var front = new FilteredElementCollector(fdoc).OfClass(typeof(View)).Cast<View>().First(v => !v.IsTemplate && v.ViewType == ViewType.Elevation && v.Name == "Front");
                    var level = new FilteredElementCollector(fdoc).OfClass(typeof(Level)).Cast<Level>().First();
                    var planes = new FilteredElementCollector(fdoc).OfClass(typeof(ReferencePlane)).Cast<ReferencePlane>().ToList();
                    var rpX0 = planes.First(r => Math.Abs(Math.Abs(r.Normal.X) - 1) < 1e-6);   // Center (Left/Right)
                    var rpY0 = planes.First(r => Math.Abs(Math.Abs(r.Normal.Y) - 1) < 1e-6);   // Center (Front/Back)
                    double L = FromMm(600), W = FromMm(400), H = FromMm(18), far = FromMm(1500);
                    var rpX = fdoc.FamilyCreate.NewReferencePlane(new XYZ(L, -far, 0), new XYZ(L, far, 0), XYZ.BasisZ, plan); rpX.Name = "SF Size X";
                    var rpY = fdoc.FamilyCreate.NewReferencePlane(new XYZ(-far, W, 0), new XYZ(far, W, 0), XYZ.BasisZ, plan); rpY.Name = "SF Size Y";
                    var rpZ = fdoc.FamilyCreate.NewReferencePlane(new XYZ(-far, 0, H), new XYZ(far, 0, H), XYZ.BasisY.Negate(), front); rpZ.Name = "SF Size Z";

                    var loop = new CurveArray();
                    var c = new[] { XYZ.Zero, new XYZ(L, 0, 0), new XYZ(L, W, 0), new XYZ(0, W, 0) };
                    for (var i = 0; i < 4; i++) loop.Append(Line.CreateBound(c[i], c[(i + 1) % 4]));
                    var profile = new CurveArrArray(); profile.Append(loop);
                    var ext = fdoc.FamilyCreate.NewExtrusion(true, profile, SketchPlane.Create(fdoc, level.Id), H);
                    fm.AssociateElementParameterToFamilyParameter(ext.get_Parameter(BuiltInParameter.MATERIAL_ID_PARAM), fp["SF_Part Material"]);
                    fdoc.Regenerate();

                    var opt = new Options { ComputeReferences = true };
                    var faces = ext.get_Geometry(opt).OfType<Solid>().Where(s => s.Volume > 0).SelectMany(s => s.Faces.OfType<PlanarFace>()).ToList();
                    PlanarFace Face(XYZ n) => faces.First(f => f.FaceNormal.IsAlmostEqualTo(n));
                    fdoc.FamilyCreate.NewAlignment(plan, rpX0.GetReference(), Face(XYZ.BasisX.Negate()).Reference).IsLocked = true;
                    fdoc.FamilyCreate.NewAlignment(plan, rpX.GetReference(), Face(XYZ.BasisX).Reference).IsLocked = true;
                    fdoc.FamilyCreate.NewAlignment(plan, rpY0.GetReference(), Face(XYZ.BasisY.Negate()).Reference).IsLocked = true;
                    fdoc.FamilyCreate.NewAlignment(plan, rpY.GetReference(), Face(XYZ.BasisY).Reference).IsLocked = true;
                    fdoc.FamilyCreate.NewAlignment(front, rpZ.GetReference(), Face(XYZ.BasisZ).Reference).IsLocked = true;

                    Dimension Dim(View v, Reference a, Reference b, Line line, FamilyParameter label)
                    {
                        var ra = new ReferenceArray(); ra.Append(a); ra.Append(b);
                        var d = fdoc.FamilyCreate.NewLinearDimension(v, line, ra); d.FamilyLabel = label; return d;
                    }
                    Dim(plan, rpX0.GetReference(), rpX.GetReference(), Line.CreateBound(new XYZ(0, -FromMm(300), 0), new XYZ(L, -FromMm(300), 0)), fp["SF_SizeX"]);
                    Dim(plan, rpY0.GetReference(), rpY.GetReference(), Line.CreateBound(new XYZ(-FromMm(300), 0, 0), new XYZ(-FromMm(300), W, 0)), fp["SF_SizeY"]);
                    Dim(front, level.GetPlaneReference(), rpZ.GetReference(), Line.CreateBound(new XYZ(-FromMm(300), 0, 0), new XYZ(-FromMm(300), 0, H)), fp["SF_SizeZ"]);

                    // Board cut size: longest (L), shortest (T) and the middle one (W), whatever way the part lies.
                    fm.SetFormula(fp["SF_Cut L"], "if(SF_SizeX > SF_SizeY, if(SF_SizeX > SF_SizeZ, SF_SizeX, SF_SizeZ), if(SF_SizeY > SF_SizeZ, SF_SizeY, SF_SizeZ))");
                    fm.SetFormula(fp["SF_Cut T"], "if(SF_SizeX < SF_SizeY, if(SF_SizeX < SF_SizeZ, SF_SizeX, SF_SizeZ), if(SF_SizeY < SF_SizeZ, SF_SizeY, SF_SizeZ))");
                    fm.SetFormula(fp["SF_Cut W"], "SF_SizeX + SF_SizeY + SF_SizeZ - SF_Cut L - SF_Cut T");
                    fdoc.OwnerFamily.get_Parameter(BuiltInParameter.FAMILY_SHARED)?.Set(p["shared"]?.GetValue<bool>() == false ? 0 : 1);
                    t.Commit();
                }
                // Flex test: three sizes, read back the box and the cut sizes.
                foreach (var s in new[] { new[] { 2785.0, 535, 43 }, new[] { 12.0, 600, 750 }, new[] { 600.0, 400, 18 } })
                {
                    using (var t = new Transaction(fdoc, "MCP: Flex"))
                    {
                        t.Start();
                        fm.Set(fp["SF_SizeX"], FromMm(s[0])); fm.Set(fp["SF_SizeY"], FromMm(s[1])); fm.Set(fp["SF_SizeZ"], FromMm(s[2]));
                        fdoc.Regenerate();
                        var ext = new FilteredElementCollector(fdoc).OfClass(typeof(Extrusion)).First();
                        var bb = ext.get_BoundingBox(null);
                        double Mm(double v) => Math.Round(v * MmPerFoot, 2);
                        double Cur(string n) => Mm(fm.CurrentType.AsDouble(fp[n]) ?? 0);
                        flex.Add(new JsonObject
                        {
                            ["set"] = new JsonArray(s[0], s[1], s[2]),
                            ["box"] = new JsonArray(Mm(bb.Max.X - bb.Min.X), Mm(bb.Max.Y - bb.Min.Y), Mm(bb.Max.Z - bb.Min.Z)),
                            ["min"] = new JsonArray(Mm(bb.Min.X), Mm(bb.Min.Y), Mm(bb.Min.Z)),
                            ["cut"] = new JsonArray(Cur("SF_Cut L"), Cur("SF_Cut W"), Cur("SF_Cut T")),
                        });
                        t.Commit();
                    }
                }
                Directory.CreateDirectory(Path.GetDirectoryName(savePath));
                fdoc.SaveAs(savePath, new SaveAsOptions { OverwriteExistingFile = true });
            }
            finally
            {
                rvt.SharedParametersFilename = oldFile ?? "";
                try { File.Delete(tmp); } catch { }
                fdoc.Close(false);
            }
            return new JsonObject { ["saved"] = savePath, ["flex"] = flex };
        }

        private static JsonNode BuildPartAssemblyFamily(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var template = ReqStr(p, "template_path");
            var partPath = ReqStr(p, "part_family_path");
            if (!File.Exists(template)) throw new ArgumentException($"Template not found: '{template}'.");
            if (!File.Exists(partPath)) throw new ArgumentException($"Part family not found: '{partPath}'.");
            var name = ReqStr(p, "family_name");
            var saveDir = ReqStr(p, "save_dir");
            var item = Str(p, "item") ?? name;
            var parts = (p["parts"] as JsonArray ?? throw new ArgumentException("parts is required.")).Select(n => n.AsObject()).ToList();
            if (parts.Count == 0) throw new ArgumentException("parts is empty.");
            var colours = p["materials"] as JsonObject;

            var mins = parts.Select(o => MmVec(o["min"])).ToList();
            var origin = new XYZ(mins.Min(v => v.X), mins.Min(v => v.Y), mins.Min(v => v.Z));
            var fdoc = app.Application.NewFamilyDocument(template);
            Family family;
            int placed = 0, moved = 0;
            try
            {
                using (var t = new Transaction(fdoc, "MCP: Part assembly"))
                {
                    t.Start();
                    if (!fdoc.LoadFamily(partPath, out Family partFam)) throw new InvalidOperationException("Could not load the part family.");
                    var sym = (FamilySymbol)fdoc.GetElement(partFam.GetFamilySymbolIds().First());
                    if (!sym.IsActive) { sym.Activate(); fdoc.Regenerate(); }
                    var mats = new Dictionary<string, ElementId>();
                    ElementId Mat(string m)
                    {
                        if (string.IsNullOrEmpty(m)) return ElementId.InvalidElementId;
                        if (mats.TryGetValue(m, out var id)) return id;
                        var found = new FilteredElementCollector(fdoc).OfClass(typeof(Material)).FirstOrDefault(e => e.Name == m);
                        id = found?.Id ?? Material.Create(fdoc, m);
                        if (colours?[m] is JsonObject col)
                            ((Material)fdoc.GetElement(id)).Color = new Color((byte)Dbl(col["r"]), (byte)Dbl(col["g"]), (byte)Dbl(col["b"]));
                        return mats[m] = id;
                    }
                    var made = new List<(FamilyInstance Inst, XYZ Target)>();
                    foreach (var o in parts)
                    {
                        XYZ a = MmVec(o["min"]) - origin, b = MmVec(o["max"]) - origin;
                        // A shaped part, extruded along "extrude" (x, y default, or z) from min to max:
                        //   profile [[p, q], ...] in project mm in the other two axes (y: [x, z]; x: [y, z]; z: [x, y]), or
                        //   circle [cx, cy, r] (z only) for round tops.
                        var axis = o["extrude"]?.ToString() ?? "y";
                        var prof = o["profile"] as JsonArray; var circ = o["circle"] as JsonArray;
                        if ((prof != null && prof.Count >= 3) || circ != null)
                        {
                            XYZ normal = axis == "x" ? XYZ.BasisX : axis == "z" ? XYZ.BasisZ : XYZ.BasisY;
                            double a0 = axis == "x" ? a.X : axis == "z" ? a.Z : a.Y, b0 = axis == "x" ? b.X : axis == "z" ? b.Z : b.Y;
                            XYZ Pt(double p, double q)
                            {
                                double P = FromMm(p), Q = FromMm(q);
                                return axis == "x" ? new XYZ(a0, P - origin.Y, Q - origin.Z)
                                     : axis == "z" ? new XYZ(P - origin.X, Q - origin.Y, a0)
                                     : new XYZ(P - origin.X, a0, Q - origin.Z);
                            }
                            var loop = new CurveArray();
                            if (circ != null)
                            {
                                var c = Pt(Dbl(circ[0]), Dbl(circ[1])); var rr = FromMm(Dbl(circ[2]));
                                loop.Append(Arc.Create(c, rr, 0, Math.PI, XYZ.BasisX, XYZ.BasisY));
                                loop.Append(Arc.Create(c, rr, Math.PI, 2 * Math.PI, XYZ.BasisX, XYZ.BasisY));
                            }
                            else
                            {
                                var pts = prof.Select(n => Pt(Dbl(n[0]), Dbl(n[1]))).ToList();
                                for (var i = 0; i < pts.Count; i++) loop.Append(Line.CreateBound(pts[i], pts[(i + 1) % pts.Count]));
                            }
                            var cpa = new CurveArrArray(); cpa.Append(loop);
                            var sp = SketchPlane.Create(fdoc, Plane.CreateByNormalAndOrigin(normal, normal * a0));
                            var ex = fdoc.FamilyCreate.NewExtrusion(true, cpa, sp, b0 - a0);
                            ex.get_Parameter(BuiltInParameter.MATERIAL_ID_PARAM)?.Set(Mat(o["mat"]?.ToString()));
                            placed++;
                            continue;
                        }
                        var inst = fdoc.FamilyCreate.NewFamilyInstance(a, sym, Autodesk.Revit.DB.Structure.StructuralType.NonStructural);
                        void Set(string pn, Action<Parameter> act) { var pr = inst.get_Parameter(Guid.Parse(PartParams.First(x => x.Name == pn).Guid)); if (pr != null && !pr.IsReadOnly) act(pr); }
                        Set("SF_SizeX", pr => pr.Set(b.X - a.X)); Set("SF_SizeY", pr => pr.Set(b.Y - a.Y)); Set("SF_SizeZ", pr => pr.Set(b.Z - a.Z));
                        Set("SF_Part Material", pr => pr.Set(Mat(o["mat"]?.ToString())));
                        Set("SF_Part Code", pr => pr.Set(o["code"]?.ToString() ?? ""));
                        Set("SF_Part Name", pr => pr.Set(o["name"]?.ToString() ?? ""));
                        Set("SF_Item", pr => pr.Set(item));
                        made.Add((inst, a));
                        placed++;
                    }
                    fdoc.Regenerate();
                    // A nested level-based instance may land on the level whatever Z it was given: move it to its target.
                    foreach (var (inst, target) in made)
                    {
                        var at = (inst.Location as LocationPoint)?.Point;
                        if (at == null) continue;
                        var d = target - at;
                        if (d.GetLength() > 1e-6) { ElementTransformUtils.MoveElement(fdoc, inst.Id, d); moved++; }
                    }
                    t.Commit();
                }
                Directory.CreateDirectory(saveDir);
                fdoc.SaveAs(Path.Combine(saveDir, name + ".rfa"), new SaveAsOptions { OverwriteExistingFile = true });
                family = doc.IsFamilyDocument ? null : fdoc.LoadFamily(doc, new OverwriteFamily());
            }
            finally
            {
                fdoc.Close(false);
            }
            var result = new JsonObject
            {
                ["family"] = name, ["parts"] = placed, ["moved_to_z"] = moved,
                ["origin_mm"] = new JsonArray(origin.X * MmPerFoot, origin.Y * MmPerFoot, origin.Z * MmPerFoot),
                ["family_id"] = family?.Id.Value,
            };
            if (family == null || p["level_id"] == null) return result;
            var level = RequireLevel(doc, ReqId(p, "level_id"));
            var mark = Str(p, "mark"); var comments = Str(p, "comments");
            return InTransaction(doc, $"Place {name}", () =>
            {
                var symbol = (FamilySymbol)doc.GetElement(family.GetFamilySymbolIds().First());
                if (!symbol.IsActive) { symbol.Activate(); doc.Regenerate(); }
                var instance = doc.Create.NewFamilyInstance(origin, symbol, level, Autodesk.Revit.DB.Structure.StructuralType.NonStructural);
                instance.get_Parameter(BuiltInParameter.INSTANCE_FREE_HOST_OFFSET_PARAM)?.Set(origin.Z - level.Elevation);
                if (mark != null) instance.get_Parameter(BuiltInParameter.ALL_MODEL_MARK)?.Set(mark);
                if (comments != null) instance.get_Parameter(BuiltInParameter.ALL_MODEL_INSTANCE_COMMENTS)?.Set(comments);
                result["id"] = instance.Id.Value;
                result["type_id"] = symbol.Id.Value;
                return result;
            });
        }
    }
}
