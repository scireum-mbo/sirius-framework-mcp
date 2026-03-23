package sirius.biz.test;

import sirius.db.jdbc.SQLEntity;
import sirius.db.mixing.Mapping;
import sirius.db.mixing.annotations.Length;
import sirius.db.mixing.annotations.NullAllowed;
import sirius.db.mixing.annotations.Trim;
import sirius.biz.web.Autoloaded;
import sirius.kernel.di.std.Framework;

@Framework("test.entities")
public class SampleEntity extends SQLTenantAware<SampleEntity, SampleUserAccount> {

    public static final Mapping NAME = Mapping.named("name");
    @Length(255)
    @Trim
    @Autoloaded
    private String name;

    public static final Mapping DESCRIPTION = Mapping.named("description");
    @Length(512)
    @NullAllowed
    private String description;

    public String getName() {
        return name;
    }
}
